import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signObjectToken } from '@estate/storage';

const put = vi.fn();
vi.mock('../../../lib/storage.js', () => ({
  getStorageBackend: () => ({ put }),
  storageSigningSecret: () => 'test-secret',
}));

const { PUT } = await import('./route.js');

const KEY = 'tenants/t1/properties/p1/abc.jpg';

function tokenFor(key = KEY, expiresInMs = 60_000): string {
  return signObjectToken(key, Date.now() + expiresInMs, 'test-secret');
}

function request(token: string | null, body: Uint8Array, contentType = 'image/jpeg'): Request {
  const url = token === null ? 'http://acme.test/api/storage/upload' : `http://acme.test/api/storage/upload?token=${encodeURIComponent(token)}`;
  return new Request(url, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  put.mockResolvedValue(undefined);
});

describe('PUT /api/storage/upload', () => {
  it('stores the body at the token-attested key with its content type', async () => {
    const body = new Uint8Array([1, 2, 3]);
    const response = await PUT(request(tokenFor(), body));

    expect(response.status).toBe(204);
    expect(put).toHaveBeenCalledTimes(1);
    const [key, data, opts] = put.mock.calls[0] as [string, Buffer, { contentType?: string }];
    expect(key).toBe(KEY);
    expect(Buffer.from(data).equals(Buffer.from([1, 2, 3]))).toBe(true);
    expect(opts).toEqual({ contentType: 'image/jpeg' });
  });

  it('rejects a missing, tampered or expired token without writing', async () => {
    const body = new Uint8Array([1]);
    expect((await PUT(request(null, body))).status).toBe(401);
    expect((await PUT(request('garbage.token.sig', body))).status).toBe(401);
    expect((await PUT(request(tokenFor(KEY, -1), body))).status).toBe(401);
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects an oversized body without writing (413)', async () => {
    const body = new Uint8Array(26 * 1024 * 1024);
    const response = await PUT(request(tokenFor(), body));
    expect(response.status).toBe(413);
    expect(put).not.toHaveBeenCalled();
  });
});
