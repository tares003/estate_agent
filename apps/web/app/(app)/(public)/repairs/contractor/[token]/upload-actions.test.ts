import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signContractorLink } from '../../../../lib/contractor-access.js';
import { verifyObjectToken } from '@estate/storage';

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../../lib/db.js', () => ({ getDb: () => ({}) }));

const storageExists = vi.fn();
vi.mock('../../../../lib/storage.js', () => ({
  getStorageBackend: () => ({ exists: storageExists }),
  storageSigningSecret: () => 'storage-secret',
}));

const audit = vi.fn();
const repairFindFirst = vi.fn();
const fileCount = vi.fn();
const fileCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({
    repairRequest: { findFirst: repairFindFirst },
    repairFile: { count: fileCount, create: fileCreate },
  }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { issueContractorUploadGrants, finalizeContractorRepairFiles } = await import(
  './upload-actions.js'
);

const LINK_SECRET = 'link-secret';
const TENANT = '00000000-0000-0000-0000-000000000001';
const REPAIR = '11111111-1111-1111-1111-111111111111';
const CONTRACTOR = '22222222-2222-2222-2222-222222222222';
const savedSecret = process.env['CONTRACTOR_LINK_SECRET'];

function token(over: { contractor?: string; expiresInMs?: number } = {}): string {
  return signContractorLink(
    REPAIR,
    over.contractor ?? CONTRACTOR,
    Date.now() + (over.expiresInMs ?? 60_000),
    LINK_SECRET,
  );
}

const meta = [{ fileName: 'done.jpg', contentType: 'image/jpeg', sizeBytes: 2048 }];

beforeEach(() => {
  vi.clearAllMocks();
  process.env['CONTRACTOR_LINK_SECRET'] = LINK_SECRET;
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  repairFindFirst.mockResolvedValue({ id: REPAIR, assignedContractorId: CONTRACTOR });
  fileCount.mockResolvedValue(0);
  fileCreate.mockResolvedValue({ id: 'file-1' });
  storageExists.mockResolvedValue(true);
});

afterEach(() => {
  if (savedSecret === undefined) delete process.env['CONTRACTOR_LINK_SECRET'];
  else process.env['CONTRACTOR_LINK_SECRET'] = savedSecret;
});

describe('issueContractorUploadGrants', () => {
  it('issues signed grants under the ticket prefix for the bound assignee', async () => {
    const result = await issueContractorUploadGrants(token(), meta);

    expect(result.ok).toBe(true);
    expect(result.grants).toHaveLength(1);
    const grant = result.grants![0]!;
    expect(grant.name).toBe('done.jpg');
    expect(grant.key).toMatch(new RegExp(`^tenants/${TENANT}/repairs/${REPAIR}/[0-9a-f-]+\\.jpg$`));
    // the grant token is a storage token verifiable for exactly that key
    expect(verifyObjectToken(grant.token, 'storage-secret', Date.now())?.key).toBe(grant.key);
  });

  it('refuses an invalid token or a non-assignee before issuing anything', async () => {
    expect((await issueContractorUploadGrants('garbage', meta)).ok).toBe(false);
    repairFindFirst.mockResolvedValue({ id: REPAIR, assignedContractorId: 'someone-else' });
    expect((await issueContractorUploadGrants(token(), meta)).ok).toBe(false);
  });

  it('rejects a disallowed attachment type', async () => {
    const result = await issueContractorUploadGrants(token(), [
      { fileName: 'x.zip', contentType: 'application/zip', sizeBytes: 1 },
    ]);
    expect(result.ok).toBe(false);
  });
});

describe('finalizeContractorRepairFiles', () => {
  const KEY = `tenants/${TENANT}/repairs/${REPAIR}/abc.jpg`;
  const file = { key: KEY, name: 'done.jpg', contentType: 'image/jpeg', sizeBytes: 2048 };

  it('records each landed file as a CONTRACTOR upload and audits (G4)', async () => {
    const result = await finalizeContractorRepairFiles(token(), [file]);

    expect(result.ok).toBe(true);
    expect(storageExists).toHaveBeenCalledWith(KEY);
    expect(fileCreate).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT,
        repairRequestId: REPAIR,
        url: KEY,
        fileName: 'done.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 2048,
        uploadedBy: 'contractor',
      },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actor: `contractor:${CONTRACTOR}`,
        action: 'repair_file.created',
        entity: 'repair_file',
        entityId: 'file-1',
      }),
    );
  });

  it('refuses a key outside the ticket prefix (no cross-ticket grafts)', async () => {
    const foreign = { ...file, key: `tenants/${TENANT}/repairs/other/abc.jpg` };
    const result = await finalizeContractorRepairFiles(token(), [foreign]);
    expect(result.ok).toBe(false);
    expect(fileCreate).not.toHaveBeenCalled();
  });

  it('refuses when the bytes never landed', async () => {
    storageExists.mockResolvedValue(false);
    expect((await finalizeContractorRepairFiles(token(), [file])).ok).toBe(false);
    expect(fileCreate).not.toHaveBeenCalled();
  });

  it('refuses a non-assignee token', async () => {
    repairFindFirst.mockResolvedValue({ id: REPAIR, assignedContractorId: 'someone-else' });
    expect((await finalizeContractorRepairFiles(token(), [file])).ok).toBe(false);
    expect(fileCreate).not.toHaveBeenCalled();
  });

  it('enforces the 10-file ticket cap', async () => {
    fileCount.mockResolvedValue(10);
    expect((await finalizeContractorRepairFiles(token(), [file])).ok).toBe(false);
    expect(fileCreate).not.toHaveBeenCalled();
  });
});
