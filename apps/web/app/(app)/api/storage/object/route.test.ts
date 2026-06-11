import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageError, signObjectToken } from '@estate/storage';

const get = vi.fn();
vi.mock('../../../lib/storage.js', () => ({
  getStorageBackend: () => ({ get }),
  storageSigningSecret: () => 'test-secret',
}));

const { GET } = await import('./route.js');

const KEY = 'tenants/t1/properties/p1/abc.jpg';

function tokenFor(key = KEY, expiresInMs = 60_000): string {
  return signObjectToken(key, Date.now() + expiresInMs, 'test-secret');
}

function request(token: string | null): Request {
  const url =
    token === null
      ? 'http://acme.test/api/storage/object'
      : `http://acme.test/api/storage/object?token=${encodeURIComponent(token)}`;
  return new Request(url, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue(Buffer.from([0xff, 0xd8]));
});

describe('GET /api/storage/object', () => {
  it('serves the token-attested object with a content type from its extension', async () => {
    const response = await GET(request(tokenFor()));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(get).toHaveBeenCalledWith(KEY);
    const body = Buffer.from(await response.arrayBuffer());
    expect(body.equals(Buffer.from([0xff, 0xd8]))).toBe(true);
  });

  it('rejects a missing, tampered or expired token without reading', async () => {
    expect((await GET(request(null))).status).toBe(401);
    expect((await GET(request('garbage'))).status).toBe(401);
    expect((await GET(request(tokenFor(KEY, -1)))).status).toBe(401);
    expect(get).not.toHaveBeenCalled();
  });

  it('404s a token for an object that no longer exists', async () => {
    get.mockRejectedValue(new StorageError('missing'));
    const response = await GET(request(tokenFor()));
    expect(response.status).toBe(404);
  });

  it('serves an unrecognised extension as a generic byte stream', async () => {
    const response = await GET(request(tokenFor('tenants/t1/files/data.bin')));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
  });

  it('rethrows a non-storage failure (a real fault is not a 404)', async () => {
    get.mockRejectedValue(new Error('disk on fire'));
    await expect(GET(request(tokenFor()))).rejects.toThrow('disk on fire');
  });
});
