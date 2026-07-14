import { PrismaClient, withTenant } from '@estate/db';
import { createLogger } from '@estate/observability';
import { findWorker, type WorkerDefinition } from '@estate/scheduler';
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
import {
  runScheduledWorker,
  type ScheduledResult,
  type ScheduledTasksClient,
  type ScheduledTenantRunner,
} from './scheduled-tasks.js';
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

// EPIC-U FR-U-9 — the saved-search digests fire at the TENANT's local hour, not a fixed
// server hour, so this is ONE hourly tick (minute hour dom month dow) rather than a cron
// per cadence. Every hour, each tenant is asked "is it your local 07:00 (or Monday 08:00)
// yet, and have you not already run today?" — see scheduled-tasks.ts. Reading the tenant's
// wall clock also makes it DST-correct: a 07:00-local digest is 06:00Z in BST and 07:00Z
// in GMT, which a fixed UTC cron gets wrong for half the year.
const SCHEDULED_TICK_CRON = '0 * * * *'; // hourly, on the hour

/** A catalogue worker by id — a typo here is a startup crash, not a silent no-op. */
function catalogueWorker(id: string): WorkerDefinition {
  const definition = findWorker(id);
  if (!definition) {
    throw new Error(`worker "${id}" is not declared in the EPIC-U catalogue`);
  }
  return definition;
}

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

  // EPIC-U + EPIC-T FR-T-7/8 — the saved-search alert digest worker, now scheduled per
  // tenant (FR-U-9). One hourly repeatable job drives both cadences: for every active
  // tenant, runScheduledWorker decides on that tenant's own clock whether the daily or
  // weekly digest is due, honours the FR-U-8 pause flag, picks up a pending Run-now, and
  // records the run in the log the console reads (FR-U-7). The digest itself is unchanged
  // — it is simply handed one tenant at a time instead of the whole list.
  const baseUrl = siteBaseUrl();
  const listScheduledTenants = (): Promise<{ id: string; timezone: string }[]> =>
    prisma.platformTenant.findMany({
      where: { status: 'active' },
      select: { id: true, timezone: true },
    });
  const runScheduledTenantFor =
    (tenantId: string): ScheduledTenantRunner =>
    (fn) =>
      withTenant(prisma, tenantId, (tx) => fn(tx as unknown as ScheduledTasksClient));
  const logScheduled = (queue: string, tenantId: string, id: string, result: ScheduledResult) => {
    if (result.status !== 'ran' || !result.recorded) return;
    const { outcome, detail, runtimeMs } = result;
    logger.info({ queue, tenantId, workerId: id, outcome, detail, runtimeMs }, 'scheduled run');
  };

  const DIGEST_WORKERS = [
    { definition: catalogueWorker('saved_search_daily'), cadence: 'daily' satisfies DigestCadence },
    {
      definition: catalogueWorker('saved_search_weekly'),
      cadence: 'weekly' satisfies DigestCadence,
    },
  ] as const;
  const INSTANT_WORKER = catalogueWorker('saved_search_instant');

  const savedSearchQueue = new Queue(SAVED_SEARCH_ALERTS_QUEUE, { connection });
  await savedSearchQueue.upsertJobScheduler('saved-search-alerts-hourly', {
    pattern: SCHEDULED_TICK_CRON,
  });
  const runSavedSearchTenantFor =
    (tenantId: string): SavedSearchTenantRunner =>
    (fn) =>
      withTenant(prisma, tenantId, (tx) => fn(tx as unknown as SavedSearchDigestClient));
  const savedSearchWorker = new Worker(
    SAVED_SEARCH_ALERTS_QUEUE,
    async () => {
      const now = new Date();
      const tenants = await listScheduledTenants();
      for (const tenant of tenants) {
        for (const { definition, cadence } of DIGEST_WORKERS) {
          const result = await runScheduledWorker({
            tenantId: tenant.id,
            timeZone: tenant.timezone,
            worker: definition,
            now,
            runTenant: runScheduledTenantFor(tenant.id),
            execute: async () => {
              const counts = await runSavedSearchDigestTick({
                cadence,
                now,
                listActiveTenants: () => Promise.resolve([{ id: tenant.id }]),
                runTenantFor: runSavedSearchTenantFor,
                ...(baseUrl !== undefined ? { baseUrl } : {}),
              });
              return counts.emailed === 0 && counts.advanced === 0
                ? null
                : `emailed ${counts.emailed}, advanced ${counts.advanced}`;
            },
          });
          logScheduled(SAVED_SEARCH_ALERTS_QUEUE, tenant.id, definition.id, result);
        }
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
      const now = new Date();
      const tenants = await listScheduledTenants();
      for (const tenant of tenants) {
        // An interval worker is always "due"; the wrapper is here for the FR-U-8 pause
        // flag, the Run-now request and the run log. An idle minute records nothing.
        const result = await runScheduledWorker({
          tenantId: tenant.id,
          timeZone: tenant.timezone,
          worker: INSTANT_WORKER,
          now,
          runTenant: runScheduledTenantFor(tenant.id),
          execute: async () => {
            const counts = await runInstantAlertsTick({
              now,
              listActiveTenants: () => Promise.resolve([{ id: tenant.id }]),
              runTenantFor: runInstantTenantFor,
              ...(baseUrl !== undefined ? { baseUrl } : {}),
            });
            return counts.emailed === 0 && counts.advanced === 0
              ? null
              : `emailed ${counts.emailed}, advanced ${counts.advanced}`;
          },
        });
        logScheduled(SAVED_SEARCH_INSTANT_QUEUE, tenant.id, INSTANT_WORKER.id, result);
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
      cron: [SCHEDULED_TICK_CRON],
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
