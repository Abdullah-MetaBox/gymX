/**
 * Shared validation for uploaded images.
 *
 * The content type is sniffed from the file's own bytes rather than trusted from
 * `file.type`, which is client-supplied and changes with a rename. SVG is not
 * accepted anywhere: it is a script container, and nothing we store — a logo or
 * a member photo — needs one.
 */

export type ImageKind = 'image/jpeg' | 'image/png' | 'image/webp';

export interface SniffedImage {
  contentType: ImageKind;
  extension: 'jpg' | 'png' | 'webp';
  bytes: Buffer;
}

/**
 * Vercel caps a serverless request body at 4.5 MB. A larger file fails with an
 * opaque 413 before any handler runs — in production only, so a 5 MB limit
 * passes every local test and then breaks on deploy.
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export type SniffResult =
  | { ok: true; image: SniffedImage }
  | { ok: false; error: string; status: 400 | 413 };

export async function sniffImage(file: File): Promise<SniffResult> {
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, status: 413, error: 'Image must be 4 MB or smaller.' };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) {
    return { ok: false, status: 400, error: 'The file is empty.' };
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ok: true, image: { contentType: 'image/jpeg', extension: 'jpg', bytes } };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { ok: true, image: { contentType: 'image/png', extension: 'png', bytes } };
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { ok: true, image: { contentType: 'image/webp', extension: 'webp', bytes } };
  }

  return {
    ok: false,
    status: 400,
    error: 'Only JPEG, PNG and WebP images are accepted.',
  };
}

/** Accept attribute for a file input, kept next to the server-side allowlist. */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
