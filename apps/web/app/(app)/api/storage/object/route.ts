import { StorageError, verifyObjectToken } from '@estate/storage';

import { getStorageBackend, storageSigningSecret } from '../../../lib/storage.js';

// CLAUDE.md §9 — the signed-object-URL server: every stored file is served
// through this handler with a time-limited HMAC token (no third-party pre-signed
// URLs, no direct filesystem exposure). The object is read at the TOKEN-ATTESTED
// key only; tampered/expired tokens are rejected before any storage read. The
// content type derives from the attested key's extension (the key was minted
// server-side from the validated upload content type).

export const dynamic = 'force-dynamic';

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

function contentTypeFor(key: string): string {
  const extension = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  const verified =
    token === null ? null : verifyObjectToken(token, storageSigningSecret(), Date.now());
  if (verified === null) {
    return new Response('Invalid or expired token.', { status: 401 });
  }

  let body: Buffer;
  try {
    body = await getStorageBackend().get(verified.key);
  } catch (error) {
    if (error instanceof StorageError) {
      return new Response('Not found.', { status: 404 });
    }
    throw error;
  }

  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      'content-type': contentTypeFor(verified.key),
      'cache-control': 'private, max-age=300',
    },
  });
}
