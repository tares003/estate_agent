'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError } from '@estate/ui';
import type { PublishPreflightItem } from '@estate/validators';

import { publishWithPreflight, type PublishPreflightState } from './publish-preflight-actions.js';

const INITIAL: PublishPreflightState = { ok: false };

/**
 * EPIC-F FR-F-8 (§H.5 Tab 9) — the Publish-tab right-rail pre-flight checklist.
 * Each of the eleven items renders a green tick when satisfied or a red cross when
 * not. When every item is green the form offers a plain Publish; when any is red it
 * offers "Override and publish anyway" with a required typed reason — which the
 * Server Action records in the audit log. On success it refreshes the route so the
 * published badge and the public catalogue reflect the change.
 *
 * The checklist is evaluated server-side and passed in as `items` / `ready`; this
 * component is presentation + the publish gesture only.
 */
export function PublishPreflight({
  propertyId,
  items,
  ready,
}: {
  propertyId: string;
  items: PublishPreflightItem[];
  ready: boolean;
}) {
  const [state, formAction, pending] = useActionState(publishWithPreflight, INITIAL);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const reasonError = state.errors?.find((error) => error.field === 'reason')?.message;

  return (
    <div className="flex max-w-[28rem] flex-col gap-4">
      <ul className="flex flex-col gap-2" aria-label="Pre-flight checklist">
        {items.map((item) => (
          <li
            key={item.key}
            data-satisfied={item.satisfied ? 'true' : 'false'}
            className="flex items-center gap-2"
          >
            <span
              aria-hidden="true"
              className={item.satisfied ? 'text-success' : 'text-danger'}
            >
              {item.satisfied ? '✓' : '✗'}
            </span>
            <span className="t-body-sm">{item.label}</span>
            <span className="sr-only">{item.satisfied ? ' — done' : ' — outstanding'}</span>
          </li>
        ))}
      </ul>

      <form action={formAction} className="flex flex-col gap-3">
        <FormError errors={state.errors?.filter((error) => error.field !== 'reason') ?? []} />
        <input type="hidden" name="id" value={propertyId} />
        <input type="hidden" name="override" value={ready ? 'false' : 'true'} />

        {ready ? null : (
          <label htmlFor="reason" className="flex flex-col gap-1">
            <span className="t-body-sm text-text-secondary">Reason for overriding</span>
            <textarea
              id="reason"
              name="reason"
              rows={2}
              className="border-divider rounded-md border px-3 py-2"
              aria-describedby="reason-hint"
            />
            <span id="reason-hint" className="t-body-sm text-text-secondary">
              Recorded in the audit log. Required to publish before the checklist is complete.
            </span>
          </label>
        )}
        {reasonError ? (
          <p role="alert" className="t-body-sm text-danger">
            {reasonError}
          </p>
        ) : null}

        <Button type="submit" variant={ready ? 'primary' : 'secondary'} size="sm" loading={pending}>
          {ready ? 'Publish' : 'Override and publish anyway'}
        </Button>
      </form>
    </div>
  );
}
