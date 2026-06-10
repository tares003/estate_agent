'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError, NumberField, TextField } from '@estate/ui';

import { updateProperty, type PropertyEditState } from './actions.js';

const INITIAL: PropertyEditState = { ok: false };

export interface PropertyEditFormProps {
  property: {
    id: string;
    title: string | null;
    displayAddress: string;
    postcode: string;
    /** Stored price in pence (the form shows pounds). */
    price: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    receptions: number | null;
    description: string | null;
  };
}

// EPIC-H property edit form (FR-H-2). A client form driven by
// `useActionState(updateProperty, …)`, pre-filled from the listing's current values
// (price shown in £). A failed submit surfaces the action's field-linked errors; on
// success it refreshes the route so the header + the catalogue reflect the change.

export function PropertyEditForm({ property }: PropertyEditFormProps) {
  const [state, formAction, pending] = useActionState(updateProperty, INITIAL);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const errorFor = (name: string) => state.errors?.find((error) => error.field === name)?.message;
  const numberValue = (value: number | null): string => (value === null ? '' : String(value));

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <FormError errors={state.errors ?? []} />
      {state.ok ? (
        <p className="t-body-sm text-success" role="status">
          Changes saved.
        </p>
      ) : null}

      <input type="hidden" name="id" value={property.id} />

      <TextField
        id="title"
        name="title"
        label="Title"
        hint="Optional"
        defaultValue={property.title ?? ''}
        error={errorFor('title')}
      />
      <TextField
        id="displayAddress"
        name="displayAddress"
        label="Display address"
        required
        defaultValue={property.displayAddress}
        error={errorFor('displayAddress')}
      />
      <TextField
        id="postcode"
        name="postcode"
        label="Postcode"
        required
        defaultValue={property.postcode}
        error={errorFor('postcode')}
      />
      <NumberField
        id="price"
        name="price"
        label="Price (£)"
        hint="Leave blank for price on application"
        defaultValue={property.price === null ? '' : String(property.price / 100)}
        error={errorFor('price')}
      />
      <NumberField
        id="bedrooms"
        name="bedrooms"
        label="Bedrooms"
        defaultValue={numberValue(property.bedrooms)}
        error={errorFor('bedrooms')}
      />
      <NumberField
        id="bathrooms"
        name="bathrooms"
        label="Bathrooms"
        defaultValue={numberValue(property.bathrooms)}
        error={errorFor('bathrooms')}
      />
      <NumberField
        id="receptions"
        name="receptions"
        label="Receptions"
        defaultValue={numberValue(property.receptions)}
        error={errorFor('receptions')}
      />
      <TextField
        id="description"
        name="description"
        label="Description"
        hint="Optional"
        defaultValue={property.description ?? ''}
        error={errorFor('description')}
      />

      <Button type="submit" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}
