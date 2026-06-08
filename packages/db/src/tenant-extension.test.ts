import { describe, expect, it, vi } from 'vitest';
import {
  tenantGucStatement,
  withTenant,
  type TenantQueryClient,
  type TenantTransactionClient,
} from './tenant-extension.js';

describe('tenantGucStatement', () => {
  it('builds a SET LOCAL statement for a valid UUID', () => {
    expect(tenantGucStatement('11111111-1111-1111-1111-111111111111')).toBe(
      "SET LOCAL app.current_tenant_id = '11111111-1111-1111-1111-111111111111'",
    );
  });

  it('rejects a non-UUID tenant id (no injection surface)', () => {
    expect(() => tenantGucStatement("'; DROP TABLE users; --")).toThrow(/UUID/);
    expect(() => tenantGucStatement('not-a-uuid')).toThrow(/UUID/);
    expect(() => tenantGucStatement('')).toThrow(/UUID/);
  });
});

describe('withTenant', () => {
  it('sets the tenant GUC before the callback runs, in one transaction', async () => {
    const issued: string[] = [];
    const tx: TenantQueryClient = {
      $executeRawUnsafe: async (q: string) => {
        issued.push(q);
        return 0;
      },
    };
    const client: TenantTransactionClient = { $transaction: async (fn) => fn(tx) };

    const result = await withTenant(client, '22222222-2222-2222-2222-222222222222', async (t) => {
      await t.$executeRawUnsafe('SELECT 1');
      return 'scoped';
    });

    expect(result).toBe('scoped');
    expect(issued).toEqual([
      "SET LOCAL app.current_tenant_id = '22222222-2222-2222-2222-222222222222'",
      'SELECT 1',
    ]);
  });

  it('rejects before opening a transaction when the tenant id is invalid', async () => {
    const client: TenantTransactionClient = { $transaction: vi.fn() };
    await expect(withTenant(client, 'bad', async () => 1)).rejects.toThrow(/UUID/);
    expect(client.$transaction).not.toHaveBeenCalled();
  });
});
