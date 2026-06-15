import { PrismaClient, withTenant } from '@estate/db';
import { createLogger } from '@estate/observability';
import { resolveSmsBackend } from '@estate/sms';
import { LocalFilesystemBackend } from '@estate/storage';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';

import { runImageTick, type ImageQueueClient, type ImageTenantRunner } from './image-processor.js';
import {
  runDispatchTick,
  type NotificationQueueClient,
  type TenantRunner,
} from './notification-dispatcher.js';
import { renderNotification } from './notification-templates.js';
import { resolveTenantMailer } from './payload-email-settings.js';
import { transformImage } from './sharp-transform.js';
import { runSmsTick, type SmsQueueClient, type SmsTenantRunner } from './sms-dispatcher.js';

// EPIC-U — the BullMQ worker entrypoint (the apps/workers process; same image as
// apps/web, different CMD). One repeatable job per queue; queues land with their
// owning epic. email-send is the notification_logs outbox dispatcher: every tick
// lists the active tenants and dispatches each tenant's queued email inside its
// own tenant (RLS) scope. Connection glue (live Redis + Postgres + SMTP) —
// excluded from unit coverage; every decision it wires is covered via injected
// fakes in notification-dispatcher.test.ts / notification-templates.test.ts.

const logger = createLogger({ name: 'workers' });

const EMAIL_SEND_QUEUE = 'email-send';
const IMAGE_QUEUE = 'image-processing';
const SMS_SEND_QUEUE = 'sms-send';
const TICK_EVERY_MS = 30_000;
const IMAGE_TICK_EVERY_MS = 60_000;
const SMS_TICK_EVERY_MS = 30_000;

function storageDir(): string {
  const raw = process.env['STORAGE_DIR'];
  if (!raw) {
    throw new Error('STORAGE_DIR is not set');
  }
  return raw;
}

/** BullMQ connection options from REDIS_URL (fails closed when unset). */
function redisConnection(): ConnectionOptions {
  const raw = process.env['REDIS_URL'];
  if (!raw) {
    throw new Error('REDIS_URL is not set');
  }
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: url.port === '' ? 6379 : Number(url.port),
    ...(url.password === '' ? {} : { password: url.password }),
    maxRetriesPerRequest: null,
  };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const connection = redisConnection();

  const queue = new Queue(EMAIL_SEND_QUEUE, { connection });
  await queue.upsertJobScheduler('email-send-tick', { every: TICK_EVERY_MS });

  const runTenantFor =
    (tenantId: string): TenantRunner =>
    (fn) =>
      withTenant(prisma, tenantId, (tx) => fn(tx as unknown as NotificationQueueClient));

  const worker = new Worker(
    EMAIL_SEND_QUEUE,
    async () => {
      const counts = await runDispatchTick({
        listActiveTenants: () =>
          prisma.platformTenant.findMany({ where: { status: 'active' }, select: { id: true } }),
        runTenantFor,
        resolveMailer: (tenantId) => resolveTenantMailer(prisma, tenantId),
        render: renderNotification,
      });
      if (counts.sent > 0 || counts.failed > 0 || counts.skipped > 0) {
        logger.info({ queue: EMAIL_SEND_QUEUE, ...counts }, 'dispatch tick');
      }
    },
    { connection },
  );

  worker.on('failed', (job, error) => {
    logger.error({ queue: EMAIL_SEND_QUEUE, jobId: job?.id, err: error }, 'job failed');
  });

  // FR-F-7 image post-processing — EXIF strip + dimensions + thumb/large variants.
  const imageQueue = new Queue(IMAGE_QUEUE, { connection });
  await imageQueue.upsertJobScheduler('image-processing-tick', { every: IMAGE_TICK_EVERY_MS });
  const imageBackend = new LocalFilesystemBackend(storageDir());
  const runImageTenantFor =
    (tenantId: string): ImageTenantRunner =>
    (fn) =>
      withTenant(prisma, tenantId, (tx) => fn(tx as unknown as ImageQueueClient));
  const imageWorker = new Worker(
    IMAGE_QUEUE,
    async () => {
      const counts = await runImageTick({
        listActiveTenants: () =>
          prisma.platformTenant.findMany({ where: { status: 'active' }, select: { id: true } }),
        runTenantFor: runImageTenantFor,
        backend: imageBackend,
        transform: transformImage,
      });
      if (counts.processed > 0 || counts.failed > 0) {
        logger.info({ queue: IMAGE_QUEUE, ...counts }, 'image tick');
      }
    },
    { connection },
  );
  imageWorker.on('failed', (job, error) => {
    logger.error({ queue: IMAGE_QUEUE, jobId: job?.id, err: error }, 'job failed');
  });

  // FR-G-3 emergency SMS — the notification_logs sms channel via Twilio. The
  // backend is resolved per tick from env (null when Twilio is unconfigured).
  const smsQueue = new Queue(SMS_SEND_QUEUE, { connection });
  await smsQueue.upsertJobScheduler('sms-send-tick', { every: SMS_TICK_EVERY_MS });
  const runSmsTenantFor =
    (tenantId: string): SmsTenantRunner =>
    (fn) =>
      withTenant(prisma, tenantId, (tx) => fn(tx as unknown as SmsQueueClient));
  const smsWorker = new Worker(
    SMS_SEND_QUEUE,
    async () => {
      const counts = await runSmsTick({
        listActiveTenants: () =>
          prisma.platformTenant.findMany({ where: { status: 'active' }, select: { id: true } }),
        runTenantFor: runSmsTenantFor,
        resolveBackend: resolveSmsBackend,
      });
      if (counts.sent > 0 || counts.failed > 0 || counts.skipped > 0) {
        logger.info({ queue: SMS_SEND_QUEUE, ...counts }, 'sms tick');
      }
    },
    { connection },
  );
  smsWorker.on('failed', (job, error) => {
    logger.error({ queue: SMS_SEND_QUEUE, jobId: job?.id, err: error }, 'job failed');
  });

  logger.info(
    {
      queues: [EMAIL_SEND_QUEUE, IMAGE_QUEUE, SMS_SEND_QUEUE],
      everyMs: [TICK_EVERY_MS, IMAGE_TICK_EVERY_MS, SMS_TICK_EVERY_MS],
    },
    'worker started',
  );

  const shutdown = async (): Promise<void> => {
    logger.info('shutting down');
    await worker.close();
    await imageWorker.close();
    await smsWorker.close();
    await queue.close();
    await imageQueue.close();
    await smsQueue.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'worker crashed on startup');
  process.exit(1);
});
