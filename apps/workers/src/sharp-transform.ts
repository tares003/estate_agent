import sharp from 'sharp';

// FR-F-7 — the byte-level transform: re-encode (sharp drops metadata unless
// explicitly asked to keep it — the EXIF/location strip), auto-orient from the
// EXIF rotation BEFORE it is discarded, and render the thumb/large variants.
// Rendition widths are V1 defaults (no committed figures in the brief): 480px
// thumb (card/grid) and 1600px large (detail hero); neither enlarges a smaller
// source. Verified against real encoded images in sharp-transform.test.ts.

const THUMB_WIDTH = 480;
const LARGE_WIDTH = 1600;

export interface TransformedImage {
  data: Buffer;
  width: number;
  height: number;
  thumb: Buffer;
  large: Buffer;
}

/** Re-encode an upload: metadata stripped, auto-oriented, plus both variants. */
export async function transformImage(input: Buffer): Promise<TransformedImage> {
  const { data, info } = await sharp(input)
    .rotate() // bake the EXIF orientation in before the EXIF is dropped
    .toBuffer({ resolveWithObject: true });

  const thumb = await sharp(data)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .toBuffer();
  const large = await sharp(data)
    .resize({ width: LARGE_WIDTH, withoutEnlargement: true })
    .toBuffer();

  return { data, width: info.width, height: info.height, thumb, large };
}
