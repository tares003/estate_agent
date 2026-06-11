import { describe, expect, it, vi } from 'vitest';

import { listRepairFiles } from './repair-files.js';

describe('listRepairFiles', () => {
  it('lists a ticket attachments oldest-first', async () => {
    const rows = [
      {
        id: 'f1',
        url: 'tenants/t/repairs/r/a.jpg',
        fileName: 'leak.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 2048,
        uploadedBy: 'tenant',
        createdAt: new Date('2026-06-10T10:00:00.000Z'),
      },
    ];
    const findMany = vi.fn().mockResolvedValue(rows);

    const out = await listRepairFiles({ repairFile: { findMany } }, 'r1');

    expect(out).toBe(rows);
    expect(findMany).toHaveBeenCalledWith({
      where: { repairRequestId: 'r1' },
      orderBy: { createdAt: 'asc' },
    });
  });
});
