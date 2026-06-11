import { describe, expect, it } from 'vitest';

import {
  REPAIR_FILE_CONTENT_TYPES,
  REPAIR_FILE_EXTENSIONS,
  REPAIR_FILE_MAX_BYTES,
  REPAIR_MAX_FILES,
  repairFilesMetaSchema,
} from './repair-file.js';

const meta = { fileName: 'leak.jpg', contentType: 'image/jpeg', sizeBytes: 1024 };

describe('repair file constraints (§G.1 step 4)', () => {
  it('allows photos and videos, each with an extension', () => {
    expect(REPAIR_FILE_CONTENT_TYPES).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/quicktime',
    ]);
    for (const type of REPAIR_FILE_CONTENT_TYPES) {
      expect(REPAIR_FILE_EXTENSIONS[type]).toMatch(/^[a-z0-9]+$/);
    }
  });

  it('caps a file at 25MB and a ticket at 10 files', () => {
    expect(REPAIR_FILE_MAX_BYTES).toBe(25 * 1024 * 1024);
    expect(REPAIR_MAX_FILES).toBe(10);
  });
});

describe('repairFilesMetaSchema', () => {
  it('accepts a valid attachment list', () => {
    expect(repairFilesMetaSchema.safeParse([meta]).success).toBe(true);
  });

  it('rejects a disallowed type, an oversize file, and too many files', () => {
    expect(
      repairFilesMetaSchema.safeParse([{ ...meta, contentType: 'application/zip' }]).success,
    ).toBe(false);
    expect(
      repairFilesMetaSchema.safeParse([{ ...meta, sizeBytes: REPAIR_FILE_MAX_BYTES + 1 }]).success,
    ).toBe(false);
    expect(repairFilesMetaSchema.safeParse(Array(11).fill(meta)).success).toBe(false);
  });

  it('rejects an empty or absurd file name', () => {
    expect(repairFilesMetaSchema.safeParse([{ ...meta, fileName: '' }]).success).toBe(false);
    expect(repairFilesMetaSchema.safeParse([{ ...meta, fileName: 'x'.repeat(256) }]).success).toBe(
      false,
    );
  });
});
