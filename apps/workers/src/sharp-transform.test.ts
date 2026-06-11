import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { transformImage } from './sharp-transform.js';

// A real sharp round-trip (no mocks): the transform is the FR-F-7 privacy /
// rendition core, so it is verified against actual encoded images.

/** A real 800×400 JPEG carrying EXIF (the metadata FR-F-7 must strip). */
async function jpegWithExif(): Promise<Buffer> {
  return sharp({
    create: { width: 800, height: 400, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Copyright: 'secret-owner', Software: 'camera-x' } } })
    .toBuffer();
}

describe('transformImage', () => {
  it('strips metadata, records the dimensions, and renders both variants', async () => {
    const input = await jpegWithExif();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const result = await transformImage(input);

    expect(result.width).toBe(800);
    expect(result.height).toBe(400);
    // EXIF (location, device, ownership metadata) must NOT survive re-encoding
    expect((await sharp(result.data).metadata()).exif).toBeUndefined();
    // the thumb is capped at its rendition width; the large keeps the original
    // (no enlargement past the source)
    expect((await sharp(result.thumb).metadata()).width).toBe(480);
    expect((await sharp(result.large).metadata()).width).toBe(800);
  });

  it('never enlarges a small source', async () => {
    const small = await sharp({
      create: { width: 200, height: 100, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .png()
      .toBuffer();

    const result = await transformImage(small);

    expect(result.width).toBe(200);
    expect((await sharp(result.thumb).metadata()).width).toBe(200);
    expect((await sharp(result.large).metadata()).width).toBe(200);
  });

  it('rejects bytes that are not an image', async () => {
    await expect(transformImage(Buffer.from('not an image'))).rejects.toThrow();
  });
});
