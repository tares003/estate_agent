import { verifyObjectToken } from '@estate/storage';
import { IMAGE_MAX_BYTES } from '@estate/validators';

import { getStorageBackend, storageSigningSecret } from '../../../lib/storage.js';

// FR-F-6 upload receiver — the local-filesystem equivalent of a pre-signed direct
// upload (CLAUDE.md §9: signed-URL route handlers, no third-party pre-signed
// URLs). The client PUTs the file bytes with a token minted by an RBAC-gated
// Server Action; the bytes land at the TOKEN-ATTESTED key only (never a
// caller-supplied one), so a token cannot be replayed against another object.
// No application logic touches the payload beyond the size guard — the body
// streams to the StorageBackend. Tampered/expired tokens are rejected before any
// read of the body; oversize uploads are refused (413).

export const dynamic = 'force-dynamic';

export async function PUT(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  const verified =
    token === null ? null : verifyObjectToken(token, storageSigningSecret(), Date.now());
  if (verified === null) {
    return new Response('Invalid or expired upload token.', { status: 401 });
  }

  const body = Buffer.from(await request.arrayBuffer());
  if (body.byteLength > IMAGE_MAX_BYTES) {
    return new Response('File too large.', { status: 413 });
  }
  if (body.byteLength === 0) {
    return new Response('Empty body.', { status: 400 });
  }

  const contentType = request.headers.get('content-type');
  await getStorageBackend().put(verified.key, body, contentType === null ? {} : { contentType });
  return new Response(null, { status: 204 });
}
