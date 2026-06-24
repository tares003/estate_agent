import { describe, expect, it } from 'vitest';

import {
  IMAGE_CONTENT_TYPES,
  IMAGE_EXTENSIONS,
  IMAGE_MAX_BYTES,
  propertyImageMetaSchema,
  propertyImageUploadSchema,
} from './image-upload.js';

const propertyId = '11111111-1111-1111-1111-111111111111';

describe('image upload constraints', () => {
  it('allows only browser-renderable image types, each with an extension', () => {
    expect(IMAGE_CONTENT_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    for (const type of IMAGE_CONTENT_TYPES) {
      expect(IMAGE_EXTENSIONS[type]).toMatch(/^[a-z]+$/);
    }
  });

  it('caps a file at 25MB', () => {
    expect(IMAGE_MAX_BYTES).toBe(25 * 1024 * 1024);
  });
});

describe('propertyImageUploadSchema', () => {
  it('accepts an allowed content type for a listing', () => {
    expect(
      propertyImageUploadSchema.safeParse({ propertyId, contentType: 'image/jpeg' }).success,
    ).toBe(true);
  });

  it('rejects a disallowed content type and a non-uuid id', () => {
    expect(
      propertyImageUploadSchema.safeParse({ propertyId, contentType: 'image/heic' }).success,
    ).toBe(false);
    expect(
      propertyImageUploadSchema.safeParse({ propertyId, contentType: 'text/html' }).success,
    ).toBe(false);
    expect(
      propertyImageUploadSchema.safeParse({ propertyId: 'nope', contentType: 'image/png' }).success,
    ).toBe(false);
  });
});

describe('propertyImageMetaSchema (FR-O-13 — mandatory alt text)', () => {
  it('accepts a non-empty alt, trimming surrounding whitespace', () => {
    const result = propertyImageMetaSchema.safeParse({
      propertyId,
      alt: '  3-bed terraced house, Acacia Avenue — photo 1  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alt).toBe('3-bed terraced house, Acacia Avenue — photo 1');
    }
  });

  it('rejects a blank alt', () => {
    expect(propertyImageMetaSchema.safeParse({ propertyId, alt: '' }).success).toBe(false);
  });

  it('rejects a whitespace-only alt (alt is mandatory for SEO + a11y)', () => {
    expect(propertyImageMetaSchema.safeParse({ propertyId, alt: '   ' }).success).toBe(false);
    expect(propertyImageMetaSchema.safeParse({ propertyId, alt: '\t\n ' }).success).toBe(false);
  });

  it('rejects a missing alt entirely', () => {
    expect(propertyImageMetaSchema.safeParse({ propertyId }).success).toBe(false);
  });
});
