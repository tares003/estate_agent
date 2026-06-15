'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, EmailField, FormError, TextField } from '@estate/ui';

import { createContractor, setContractorActive, type ContractorActionState } from './actions.js';

// EPIC-G contractor directory admin (FR-G-8). An add form (driven by
// useActionState) plus a table of the tenant's contractors with a one-click
// Activate / Deactivate toggle. Mutations call the audited server actions and
// refresh the RSC tree. Assigning a contractor to a ticket is the next slice.

const INITIAL: ContractorActionState = { ok: false };

export interface ManagedContractor {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  trade: string | null;
  active: boolean;
}

export function ContractorsManager({ contractors }: { contractors: ManagedContractor[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createContractor, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  async function toggle(id: string, nextActive: boolean): Promise<void> {
    const formData = new FormData();
    formData.set('id', id);
    formData.set('active', nextActive ? 'true' : 'false');
    const result = await setContractorActive({ ok: false }, formData);
    if (result.ok) router.refresh();
  }

  const errorFor = (name: string) => state.errors?.find((error) => error.field === name)?.message;

  return (
    <div className="flex flex-col gap-8">
      <form ref={formRef} action={formAction} className="flex max-w-[40rem] flex-col gap-4">
        <h2 className="t-heading-sm">Add a contractor</h2>
        <FormError errors={state.errors?.filter((error) => error.field === undefined) ?? []} />
        <TextField id="name" name="name" label="Name" required error={errorFor('name')} />
        <EmailField id="email" name="email" label="Email" required error={errorFor('email')} />
        <TextField
          id="phone"
          name="phone"
          label="Phone"
          hint="Optional"
          error={errorFor('phone')}
        />
        <TextField
          id="trade"
          name="trade"
          label="Trade"
          hint="Optional — e.g. plumbing, electrical"
        />
        <Button type="submit" loading={pending}>
          Add contractor
        </Button>
      </form>

      {contractors.length === 0 ? (
        <p className="t-body-sm text-text-secondary">No contractors yet.</p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-divider border-b">
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Name
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Trade
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Email
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Status
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {contractors.map((contractor) => (
              <tr key={contractor.id} className="border-divider border-b">
                <td className="t-body-md py-3 pr-4">{contractor.name}</td>
                <td className="t-body-md py-3 pr-4">{contractor.trade ?? '—'}</td>
                <td className="t-body-md py-3 pr-4">{contractor.email}</td>
                <td className="py-3 pr-4">
                  {contractor.active ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="neutral">Inactive</Badge>
                  )}
                </td>
                <td className="py-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void toggle(contractor.id, !contractor.active)}
                  >
                    {contractor.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
