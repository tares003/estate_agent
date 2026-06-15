'use client';

import { useState } from 'react';
import { Button, FileDropzone, FormError } from '@estate/ui';

import { finalizeContractorRepairFiles, issueContractorUploadGrants } from './upload-actions.js';

// EPIC-G contractor portal (FR-G-8) — completion-photo upload. Runs the same
// issue → PUT → finalize flow as the tenant's repair attachments, but every step
// is authorised by the magic-link token (passed through to the server actions).
// On success it tallies the uploads and clears the picker.

export function ContractorPhotoUpload({ token }: { token: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState(0);
  const [failed, setFailed] = useState(false);

  async function upload(): Promise<void> {
    if (files.length === 0) return;
    setBusy(true);
    setFailed(false);
    try {
      const meta = files.map((file) => ({
        name: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      }));
      const grant = await issueContractorUploadGrants(token, meta);
      if (!grant.ok || !grant.grants) {
        setFailed(true);
        return;
      }
      const landed: Array<{ key: string; name: string; contentType: string; sizeBytes: number }> =
        [];
      for (const issued of grant.grants) {
        const file = files.find((candidate) => candidate.name === issued.name);
        if (!file) continue;
        const response = await fetch(
          `/api/storage/upload?token=${encodeURIComponent(issued.token)}`,
          { method: 'PUT', headers: { 'content-type': file.type }, body: file },
        );
        if (!response.ok) {
          setFailed(true);
          continue;
        }
        landed.push({
          key: issued.key,
          name: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        });
      }
      if (landed.length > 0) {
        const finalized = await finalizeContractorRepairFiles(token, landed);
        if (finalized.ok) {
          setUploaded((count) => count + landed.length);
          setFiles([]);
        } else {
          setFailed(true);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-[28rem] flex-col gap-3">
      {failed ? (
        <FormError
          errors={[{ message: 'Some photos could not be uploaded — please try again.' }]}
        />
      ) : null}
      {uploaded > 0 ? (
        <p className="t-body-sm text-text-secondary" role="status">
          {uploaded} photo{uploaded === 1 ? '' : 's'} uploaded. Thank you.
        </p>
      ) : null}
      <FileDropzone
        label="Completion photos"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
        onFiles={setFiles}
      />
      <Button type="button" loading={busy} onClick={() => void upload()}>
        Upload photos
      </Button>
    </div>
  );
}
