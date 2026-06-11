import { z } from 'zod';

// EPIC-F property images (FR-F-6) — the upload constraints. V1 accepts only
// browser-renderable types (no post-process job exists yet to transcode HEIC —
// FR-F-7 re-encoding/variants run later on the workers); the 25MB ceiling matches
// the master spec's per-file upload cap (§G.1 step 5 uses the same figure).
// Pure + IO-free.

export const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

/** The storage-key extension per allowed content type. */
export const IMAGE_EXTENSIONS: Record<ImageContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Per-file upload ceiling (25MB). */
export const IMAGE_MAX_BYTES = 25 * 1024 * 1024;

export const propertyImageUploadSchema = z.object({
  propertyId: z.string().uuid(),
  contentType: z.enum(IMAGE_CONTENT_TYPES),
});

export type PropertyImageUpload = z.infer<typeof propertyImageUploadSchema>;
