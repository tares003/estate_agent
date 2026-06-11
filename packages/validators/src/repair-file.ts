import { z } from 'zod';

// EPIC-G repair attachments (FR-G-2, master spec §G.1 step 4) — the constraints
// for the photos / videos a tenant attaches to a ticket. Photo types match the
// property-image set (browser-renderable; no HEIC — no transcode job for it);
// video accepts the spec's mp4 / mov, stored as opaque blobs (no processing).
// 25MB per file and 10 files per ticket are the spec's caps. Pure + IO-free.

export const REPAIR_FILE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
] as const;
export type RepairFileContentType = (typeof REPAIR_FILE_CONTENT_TYPES)[number];

/** The storage-key extension per allowed content type. */
export const REPAIR_FILE_EXTENSIONS: Record<RepairFileContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

/** Per-file upload ceiling (25MB — §G.1). */
export const REPAIR_FILE_MAX_BYTES = 25 * 1024 * 1024;

/** Per-ticket attachment ceiling (§G.1 step 4). */
export const REPAIR_MAX_FILES = 10;

export const repairFileMetaSchema = z.object({
  // The attachment's file name (not a person's name — G5 scans for personal data).
  fileName: z.string().min(1).max(255),
  contentType: z.enum(REPAIR_FILE_CONTENT_TYPES),
  sizeBytes: z.number().int().positive().max(REPAIR_FILE_MAX_BYTES),
});

export const repairFilesMetaSchema = z.array(repairFileMetaSchema).max(REPAIR_MAX_FILES);

export type RepairFileMeta = z.infer<typeof repairFileMetaSchema>;
