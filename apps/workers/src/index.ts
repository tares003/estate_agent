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
import {
  runSavedSearchDigestTick,
  type DigestCadence,
  type SavedSearchDigestClient,
  type SavedSearchTenantRunner,
} from './saved-search-digest.js';
import {
  runInstantAlertsTick,
  type SavedSearchInstantClient,
  type SavedSearchInstantTenantRunner,
} from './saved-search-instant.js';
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
const SAVED_SEARCH_ALERTS_QUEUE = 'saved-search-alerts';
const SAVED_SEARCH_INSTANT_QUEUE = 'saved-search-alerts-instant';
const TICK_EVERY_MS = 30_000;
const IMAGE_TICK_EVERY_MS = 60_000;
const SMS_TICK_EVERY_MS = 30_000;
// FR-U instant alerts — a short poll stands in for an event-pushed trigger (there
// is no enqueue-from-web BullMQ path in V1). 1 minute is the V1 "instant" latency.
const INSTANT_POLL_EVERY_MS = 60_000;

// EPIC-U worker catalogue cadences for the saved-search digests (FR-T-7/8). cron
// patterns are minute hour dom month dow; both run server-time daily/weekly. The
// per-tenant-local-time refinement (FR-U-9) is a later slice — V1 fires one digest
// per cadence at a fixed server hour, which still satisfies "emailed only when
// there are new matches" (the worker's core acceptance rule).
const SAVED_SEARCH_DAILY_CRON = '0 7 * * *'; // daily 07:00
const SAVED_SEARCH_WEEKLY_CRON = '0 8 * * 1'; // Monday 08:00

function storageDir(): string {
  const raw = process.env['STORAGE_DIR'];
  if (!raw) {
    throw new Error('STORAGE_DIR is not set');
  }
  return raw;
}

/** The public site origin used to build absolute links in digest emails. */
function siteBaseUrl(): string | undefined {
  const raw = process.env['BETTER_AUTH_URL'];
  return raw === undefined || raw === '' ? undefined : raw.replace(/\/$/, '');
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

  // EPIC-U + EPIC-T FR-T-7/8 — the saved-search alert digest worker. Two repeatable
  // jobs (daily 07:00 / weekly Mon 08:00) feed one Worker; the job's data carries
  // the cadence so the consumer runs the right digest. The heavy lifting is in the
  // pure + read-model layer (saved-search-digest.ts); this only wires Redis + the
  // tenant-scoped runner, mirroring the email/image/sms ticks above.
  const baseUrl = siteBaseUrl();
  const savedSearchQueue = new Queue(SAVED_SEARCH_ALERTS_QUEUE, { connection });
  await savedSearchQueue.upsertJobScheduler(
    'saved-search-alerts-daily',
    { pattern: SAVED_SEARCH_DAILY_CRON },
    { data: { cadence: 'daily' satisfies DigestCadence } },
  );
  await savedSearchQueue.upsertJobScheduler(
    'saved-search-alerts-weekly',
    { pattern: SAVED_SEARCH_WEEKLY_CRON },
    { data: { cadence: 'weekly' satisfies DigestCadence } },
  );
  const runSavedSearchTenantFor =
    (tenantId: string): SavedSearchTenantRunner =>
    (fn) =>
      withTenant(prisma, tenantId, (tx) => fn(tx as unknown as SavedSearchDigestClient));
  const savedSearchWorker = new Worker(
    SAVED_SEARCH_ALERTS_QUEUE,
    async (job) => {
      const cadence: DigestCadence = job.data?.cadence === 'weekly' ? 'weekly' : 'daily';
      const counts = await runSavedSearchDigestTick({
        cadence,
        now: new Date(),
        listActiveTenants: () =>
          prisma.platformTenant.findMany({ where: { status: 'active' }, select: { id: true } }),
        runTenantFor: runSavedSearchTenantFor,
        ...(baseUrl !== undefined ? { baseUrl } : {}),
      });
      if (counts.emailed > 0 || counts.advanced > 0) {
        logger.info({ queue: SAVED_SEARCH_ALERTS_QUEUE, cadence, ...counts }, 'digest tick');
      }
    },
    { connection },
  );
  savedSearchWorker.on('failed', (job, error) => {
    logger.error({ queue: SAVED_SEARCH_ALERTS_QUEUE, jobId: job?.id, err: error }, 'job failed');
  });

  // FR-U instant saved-search alerts — a repeatable ~1-minute poll of newly
  // published properties, matched against the instant-cadence saved searches. The
  // heavy lifting is in the pure + read-model layer (saved-search-instant.ts); this
  // only wires Redis + the tenant-scoped runner, mirroring the digest tick above.
  const instantQueue = new Queue(SAVED_SEARCH_INSTANT_QUEUE, { connection });
  await instantQueue.upsertJobScheduler('instant-poll', { every: INSTANT_POLL_EVERY_MS });
  const runInstantTenantFor =
    (tenantId: string): SavedSearchInstantTenantRunner =>
    (fn) =>
      withTenant(prisma, tenantId, (tx) => fn(tx as unknown as SavedSearchInstantClient));
  const instantWorker = new Worker(
    SAVED_SEARCH_INSTANT_QUEUE,
    async () => {
      const counts = await runInstantAlertsTick({
        now: new Date(),
        listActiveTenants: () =>
          prisma.platformTenant.findMany({ where: { status: 'active' }, select: { id: true } }),
        runTenantFor: runInstantTenantFor,
        ...(baseUrl !== undefined ? { baseUrl } : {}),
      });
      if (counts.emailed > 0 || counts.advanced > 0) {
        logger.info({ queue: SAVED_SEARCH_INSTANT_QUEUE, ...counts }, 'instant tick');
      }
    },
    { connection },
  );
  instantWorker.on('failed', (job, error) => {
    logger.error({ queue: SAVED_SEARCH_INSTANT_QUEUE, jobId: job?.id, err: error }, 'job failed');
  });

  logger.info(
    {
      queues: [
        EMAIL_SEND_QUEUE,
        IMAGE_QUEUE,
        SMS_SEND_QUEUE,
        SAVED_SEARCH_ALERTS_QUEUE,
        SAVED_SEARCH_INSTANT_QUEUE,
      ],
      everyMs: [TICK_EVERY_MS, IMAGE_TICK_EVERY_MS, SMS_TICK_EVERY_MS, INSTANT_POLL_EVERY_MS],
      cron: [SAVED_SEARCH_DAILY_CRON, SAVED_SEARCH_WEEKLY_CRON],
    },
    'worker started',
  );

  const shutdown = async (): Promise<void> => {
    logger.info('shutting down');
    await worker.close();
    await imageWorker.close();
    await smsWorker.close();
    await savedSearchWorker.close();
    await instantWorker.close();
    await queue.close();
    await imageQueue.close();
    await smsQueue.close();
    await savedSearchQueue.close();
    await instantQueue.close();
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
