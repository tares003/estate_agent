'use server';

import { randomUUID } from 'node:crypto';

import { signObjectToken } from '@estate/storage';
import {
  REPAIR_FILE_EXTENSIONS,
  REPAIR_MAX_FILES,
  repairFilesMetaSchema,
} from '@estate/validators';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { contractorLinkSecret, verifyContractorLink } from '../../../../lib/contractor-access.js';
import { getDb } from '../../../../lib/db.js';
import { getStorageBackend, storageSigningSecret } from '../../../../lib/storage.js';
import { getCurrentTenantId, getRequestIp } from '../../../../lib/tenant.js';

// EPIC-G contractor portal (FR-G-8) — completion-photo upload, WITHOUT signing in.
// Same shape as the tenant's repair-file upload (B70) but the magic-link token is
// the authorisation, not a Turnstile challenge: every call re-verifies the token,
// resolves the tenant from the host, and binds to the ticket's CURRENT assignee
// before issuing a grant or recording a file. Grants are signed STORAGE tokens
// (the PUT route at /api/storage/upload accepts them) for keys under the ticket's
// tenant prefix; finalize re-checks the prefix, the storage existence, and the
// §G.1 ten-file cap, then records each file as `uploadedBy: contractor` with an
// audit row (G4).

interface ContractorFileClient extends AuditWriter {
  repairRequest: {
    findFirst(args: {
      where: Record<string, unknown>;
    }): Promise<{ id: string; assignedContractorId: string | null } | null>;
  };
  repairFile: {
    count(args: { where?: Record<string, unknown> }): Promise<number>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
}

/** A signed grant authorising a PUT of one completion file. */
export interface ContractorUploadGrant {
  key: string;
  token: string;
  name: string;
}

export interface ContractorUploadGrantState {
  ok: boolean;
  grants?: ContractorUploadGrant[];
  errors?: FormErrorItem[];
}

export interface ContractorFinalizeState {
  ok: boolean;
  errors?: FormErrorItem[];
}

/** One landed completion file, echoed back from the client after its PUT. */
export interface ContractorFileInput {
  key: string;
  name: string;
  contentType: string;
  sizeBytes: number;
}

const GRANT_TTL_MS = 15 * 60_000;

/** Verify the magic-link and confirm it is for the ticket's CURRENT assignee. */
async function authorize(
  token: string,
): Promise<{ tenantId: string; repairRequestId: string; contractorId: string } | null> {
  const verified = verifyContractorLink(token, contractorLinkSecret(), Date.now());
  if (verified === null) return null;
  const tenantId = await getCurrentTenantId();
  const bound = await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as ContractorFileClient;
    const ticket = await tx.repairRequest.findFirst({ where: { id: verified.repairRequestId } });
    return ticket && ticket.assignedContractorId === verified.contractorId;
  });
  return bound ? { tenantId, ...verified } : null;
}

function validateMeta(
  files: Array<{ name: string; contentType: string; sizeBytes: number }>,
): boolean {
  if (files.length === 0) return false;
  return repairFilesMetaSchema.safeParse(
    files.map((file) => ({
      fileName: file.name,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
    })),
  ).success;
}

/** Issue signed grants for the contractor's declared completion files. */
export async function issueContractorUploadGrants(
  token: string,
  files: Array<{ name: string; contentType: string; sizeBytes: number }>,
): Promise<ContractorUploadGrantState> {
  const refused: ContractorUploadGrantState = {
    ok: false,
    errors: [{ message: 'Those files cannot be uploaded.' }],
  };
  if (!validateMeta(files)) return refused;

  const auth = await authorize(token);
  if (auth === null) return refused;

  const expiry = Date.now() + GRANT_TTL_MS;
  const secret = storageSigningSecret();
  const grants = files.map((file) => {
    const extension =
      REPAIR_FILE_EXTENSIONS[file.contentType as keyof typeof REPAIR_FILE_EXTENSIONS];
    const key = `tenants/${auth.tenantId}/repairs/${auth.repairRequestId}/${randomUUID()}.${extension}`;
    return { key, token: signObjectToken(key, expiry, secret), name: file.name };
  });
  return { ok: true, grants };
}

/** Record the contractor's landed completion files against the ticket (G4). */
export async function finalizeContractorRepairFiles(
  token: string,
  files: ContractorFileInput[],
): Promise<ContractorFinalizeState> {
  const refused: ContractorFinalizeState = {
    ok: false,
    errors: [{ message: 'Those files could not be recorded.' }],
  };
  if (!validateMeta(files)) return refused;

  const auth = await authorize(token);
  if (auth === null) return refused;

  const { tenantId, repairRequestId, contractorId } = auth;
  const ip = await getRequestIp();

  const prefix = `tenants/${tenantId}/repairs/${repairRequestId}/`;
  if (files.some((file) => !file.key.startsWith(prefix))) {
    return refused;
  }

  const backend = getStorageBackend();
  for (const file of files) {
    if (!(await backend.exists(file.key))) {
      return refused;
    }
  }

  let result: ContractorFinalizeState = refused;
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as ContractorFileClient;
    const attached = await tx.repairFile.count({ where: { repairRequestId } });
    if (attached + files.length > REPAIR_MAX_FILES) {
      return; // result stays refused
    }
    for (const file of files) {
      const created = await tx.repairFile.create({
        data: {
          tenantId,
          repairRequestId,
          url: file.key,
          fileName: file.name,
          mimeType: file.contentType,
          fileSizeBytes: file.sizeBytes,
          uploadedBy: 'contractor',
        },
      });
      await audit(tx, {
        tenantId,
        actor: `contractor:${contractorId}`,
        action: 'repair_file.created',
        entity: 'repair_file',
        entityId: created.id,
        ip,
      });
    }
    result = { ok: true };
  });
  return result;
}
