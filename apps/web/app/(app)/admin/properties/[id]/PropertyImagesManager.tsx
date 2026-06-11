'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, FileDropzone, FormError, TextField } from '@estate/ui';
import type { FormErrorItem } from '@estate/ui';

import {
  createPropertyImageUpload,
  deletePropertyImage,
  finalizePropertyImage,
  setPrimaryPropertyImage,
} from './image-actions.js';

// EPIC-F property images (FR-H-2 manager over the FR-F-6 pipeline). Upload runs
// the three-step flow: issue a signed grant (RBAC server-side) → PUT the bytes to
// the signed upload route → finalize (records the row + audit). Every image
// carries alt text (G9 — never decorative-by-default); the hero is marked by the
// label, not colour alone. Promote/delete call their audited server actions and
// refresh the RSC tree.

/** One gallery entry, with its render-time signed thumbnail path. */
export interface ManagedPropertyImage {
  id: string;
  alt: string;
  isPrimary: boolean;
  thumbUrl: string;
}

export function PropertyImagesManager({
  propertyId,
  images,
}: {
  propertyId: string;
  images: readonly ManagedPropertyImage[];
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FormErrorItem[]>([]);

  async function upload(): Promise<void> {
    const file = files[0];
    if (!file || alt.trim() === '') {
      setErrors([{ message: 'Choose an image and describe it before uploading.' }]);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const grant = await createPropertyImageUpload({ propertyId, contentType: file.type });
      if (!grant.ok || !grant.token || !grant.key) {
        setErrors(grant.errors ?? [{ message: 'The upload could not be started.' }]);
        return;
      }
      const response = await fetch(`/api/storage/upload?token=${encodeURIComponent(grant.token)}`, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!response.ok) {
        setErrors([{ message: 'The upload failed — try again.' }]);
        return;
      }
      const finalized = await finalizePropertyImage({
        propertyId,
        key: grant.key,
        alt: alt.trim(),
      });
      if (!finalized.ok) {
        setErrors(finalized.errors ?? [{ message: 'The upload could not be recorded.' }]);
        return;
      }
      setFiles([]);
      setAlt('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function promote(imageId: string): Promise<void> {
    const result = await setPrimaryPropertyImage({ propertyId, imageId });
    if (result.ok) router.refresh();
    else setErrors(result.errors ?? []);
  }

  async function remove(imageId: string): Promise<void> {
    const result = await deletePropertyImage({ propertyId, imageId });
    if (result.ok) router.refresh();
    else setErrors(result.errors ?? []);
  }

  return (
    <div className="flex flex-col gap-5">
      <FormError errors={errors} />

      {images.length === 0 ? (
        <p className="t-body-sm text-text-secondary">No images yet — the first becomes the hero.</p>
      ) : (
        <ul className="flex flex-wrap gap-4">
          {images.map((image) => (
            <li key={image.id} className="flex w-40 flex-col gap-2">
              {/* a signed, expiring thumbnail path — next/image gains nothing here */}
              <img
                src={image.thumbUrl}
                alt={image.alt}
                className="border-divider aspect-[4/3] w-full rounded-md border object-cover"
              />
              <div className="flex flex-wrap items-center gap-2">
                {image.isPrimary ? (
                  <Badge tone="info">Hero</Badge>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void promote(image.id)}
                  >
                    Make hero
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void remove(image.id)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex max-w-[28rem] flex-col gap-3">
        <FileDropzone
          label="Add an image"
          accept="image/jpeg,image/png,image/webp"
          onFiles={setFiles}
        />
        <TextField
          id="image-alt"
          name="alt"
          label="Alt text"
          hint="Describes the image for screen readers and search."
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
        />
        <Button type="button" loading={busy} onClick={() => void upload()}>
          Upload image
        </Button>
      </div>
    </div>
  );
}
