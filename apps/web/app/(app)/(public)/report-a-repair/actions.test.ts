import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyObjectToken } from '@estate/storage';

// Real @estate/validators (repairRequestSchema) drives the rules; the data layer,
// request context and anti-spam verifier are doubled so the action is exercised in
// isolation.
const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const storageExists = vi.fn();
vi.mock('../../lib/storage.js', () => ({
  getStorageBackend: () => ({ exists: storageExists }),
  storageSigningSecret: () => 'test-secret',
}));

const verifyTurnstile = vi.fn();
vi.mock('../../lib/turnstile.js', () => ({
  verifyTurnstile: (...args: unknown[]) => verifyTurnstile(...args),
}));

const audit = vi.fn();
const recordConsent = vi.fn();
const notify = vi.fn();
const repairCreate = vi.fn();
const repairCount = vi.fn();
const repairFindFirst = vi.fn();
const fileCount = vi.fn();
const fileCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({
    repairRequest: { create: repairCreate, count: repairCount, findFirst: repairFindFirst },
    repairFile: { count: fileCount, create: fileCreate },
  }),
);
vi.mock('@estate/db', () => ({ withTenant, audit, recordConsent, notify }));

const { submitRepairRequest, finalizeRepairFiles } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    name: 'Tess Tenant',
    email: 'tess@example.com',
    phone: '07700900000',
    propertyReference: 'Flat 2, 14 Palatine Road',
    category: 'Plumbing',
    description: 'The kitchen tap is leaking steadily under the sink.',
    urgency: 'urgent',
    gdpr_consent: 'on',
    'cf-turnstile-response': 'turnstile-token',
    ...over,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  verifyTurnstile.mockResolvedValue(true);
  repairCreate.mockResolvedValue({ id: 'rep-1' });
  repairCount.mockResolvedValue(41);
  repairFindFirst.mockResolvedValue({ id: 'rep-1' });
  fileCount.mockResolvedValue(0);
  fileCreate.mockResolvedValue({ id: 'file-1' });
  storageExists.mockResolvedValue(true);
});

describe('submitRepairRequest', () => {
  it('records consent + the ticket (with its §G.1 reference) + audit + the queued confirmation (G4/G5, FR-G-3)', async () => {
    const result = await submitRepairRequest({ ok: false }, form());

    expect(result.ok).toBe(true);
    expect(result.reference).toMatch(/^RPR-\d{4}-00042$/); // count 41 → next sequence 42
    expect(recordConsent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scope: 'repair_form', subject: 'tess@example.com' }),
    );
    expect(repairCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT,
        name: 'Tess Tenant',
        email: 'tess@example.com',
        reference: result.reference,
        propertyReference: 'Flat 2, 14 Palatine Road',
        category: 'Plumbing',
        urgency: 'urgent',
      }),
    });
    // the tenant confirmation is QUEUED in the same transaction (§H.13 — the
    // worker dispatches; the action only records intent)
    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT,
        event: 'repair_request.received',
        channel: 'email',
        recipient: 'tess@example.com',
        payload: expect.objectContaining({ reference: result.reference }),
      }),
    );
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'repair_request.created', entityId: 'rep-1' }),
    );
  });

  it('retries once when the reference collides under concurrency (unique violation)', async () => {
    withTenant
      .mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }))
      .mockImplementationOnce(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
        fn({ repairRequest: { create: repairCreate, count: repairCount } }),
      );

    const result = await submitRepairRequest({ ok: false }, form());

    expect(result.ok).toBe(true);
    expect(withTenant).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid submission before any write', async () => {
    const result = await submitRepairRequest({ ok: false }, form({ email: 'not-an-email' }));

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('rejects an unknown urgency before any write', async () => {
    const result = await submitRepairRequest({ ok: false }, form({ urgency: 'whenever' }));
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only required field as missing (no write)', async () => {
    const result = await submitRepairRequest({ ok: false }, form({ description: '   ' }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'description' })]),
    );
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('requires consent', async () => {
    const result = await submitRepairRequest({ ok: false }, form({ gdpr_consent: 'off' }));
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('fails closed when the anti-spam challenge does not verify (no writes)', async () => {
    verifyTurnstile.mockResolvedValue(false);
    const result = await submitRepairRequest({ ok: false }, form());

    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
    expect(repairCreate).not.toHaveBeenCalled();
  });

  it('passes the verified Turnstile token to the anti-spam check', async () => {
    await submitRepairRequest({ ok: false }, form());
    expect(verifyTurnstile).toHaveBeenCalledWith('turnstile-token', '203.0.113.7');
  });
});

const REP = 'rep-1';

describe('submitRepairRequest — upload grants (FR-G-2)', () => {
  const filesMeta = JSON.stringify([
    { fileName: 'leak.jpg', contentType: 'image/jpeg', sizeBytes: 2048 },
  ]);

  it('issues signed grants bound under the new ticket after the verified submit', async () => {
    const result = await submitRepairRequest({ ok: false }, form({ filesMeta }));

    expect(result.ok).toBe(true);
    expect(result.repairRequestId).toBe(REP);
    expect(result.uploadGrants).toHaveLength(1);
    const grant = result.uploadGrants![0]!;
    expect(grant.name).toBe('leak.jpg');
    expect(grant.key).toMatch(new RegExp(`^tenants/${TENANT}/repairs/${REP}/[0-9a-f-]+\\.jpg$`));
    const verified = verifyObjectToken(grant.token, 'test-secret', Date.now());
    expect(verified?.key).toBe(grant.key);
  });

  it('issues no grants when no files were declared', async () => {
    const result = await submitRepairRequest({ ok: false }, form());
    expect(result.ok).toBe(true);
    expect(result.uploadGrants).toBeUndefined();
  });

  it('rejects a disallowed attachment type before any write', async () => {
    const bad = JSON.stringify([
      { fileName: 'x.zip', contentType: 'application/zip', sizeBytes: 1 },
    ]);
    const result = await submitRepairRequest({ ok: false }, form({ filesMeta: bad }));
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });
});

describe('finalizeRepairFiles', () => {
  const KEY = `tenants/${TENANT}/repairs/${REP}/abc.jpg`;
  const file = { key: KEY, name: 'leak.jpg', contentType: 'image/jpeg', sizeBytes: 2048 };

  it('records each landed file against the ticket and audits (G4)', async () => {
    const result = await finalizeRepairFiles({ repairRequestId: REP, files: [file] });

    expect(result.ok).toBe(true);
    expect(storageExists).toHaveBeenCalledWith(KEY);
    expect(fileCreate).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT,
        repairRequestId: REP,
        url: KEY,
        fileName: 'leak.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 2048,
      },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'repair_file.created',
        entity: 'repair_file',
        entityId: 'file-1',
      }),
    );
  });

  it('refuses a key outside the ticket prefix without writing (no cross-ticket grafts)', async () => {
    const foreign = { ...file, key: `tenants/${TENANT}/repairs/other/abc.jpg` };
    const result = await finalizeRepairFiles({ repairRequestId: REP, files: [foreign] });
    expect(result.ok).toBe(false);
    expect(fileCreate).not.toHaveBeenCalled();
  });

  it('refuses an upload that never landed in storage', async () => {
    storageExists.mockResolvedValue(false);
    const result = await finalizeRepairFiles({ repairRequestId: REP, files: [file] });
    expect(result.ok).toBe(false);
    expect(fileCreate).not.toHaveBeenCalled();
  });

  it('enforces the 10-file ticket cap counting what is already attached', async () => {
    fileCount.mockResolvedValue(10);
    const result = await finalizeRepairFiles({ repairRequestId: REP, files: [file] });
    expect(result.ok).toBe(false);
    expect(fileCreate).not.toHaveBeenCalled();
  });

  it('refuses an unknown ticket (cross-tenant ids look unknown under RLS)', async () => {
    repairFindFirst.mockResolvedValue(null);
    const result = await finalizeRepairFiles({ repairRequestId: REP, files: [file] });
    expect(result.ok).toBe(false);
    expect(fileCreate).not.toHaveBeenCalled();
  });
});
