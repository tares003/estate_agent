'use client';

import { useEffect, useState, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmailField, FormError, FormSuccess, PhoneField } from '@estate/ui';

import type { RepairNotificationRecipients } from '../../../lib/repair-notification-config.js';
import {
  saveRepairNotificationConfig,
  type RepairNotificationConfigActionState,
} from './actions.js';

// EPIC-G FR-G-3 (audit finding repair-emergency-internal-notifications-missing) —
// the repair notification routing editor. Two channels per master spec §G.7: the
// repairs-queue email alerted on EVERY new ticket, and the on-call manager's
// phone paged by SMS on an EMERGENCY ticket. Leaving a field empty turns that
// channel off. Posts named fields to the audited, setting.manage-gated
// saveRepairNotificationConfig action; the schema validates server-side.

const INITIAL_STATE: RepairNotificationConfigActionState = { ok: false };

export function RepairNotificationConfigEditor({
  config,
}: {
  config: RepairNotificationRecipients;
}) {
  const [state, formAction, pending] = useActionState(saveRepairNotificationConfig, INITIAL_STATE);
  const [repairsEmail, setRepairsEmail] = useState(config.repairsEmail ?? '');
  const [onCallPhone, setOnCallPhone] = useState(config.onCallPhone ?? '');
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex max-w-[40rem] flex-col gap-8">
      <FormError errors={state.errors ?? []} />
      {state.ok ? <FormSuccess title="Repair notification settings saved." /> : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="t-body-md font-semibold">Internal recipients</legend>
        <EmailField
          id="repairs-email"
          name="repairsEmail"
          label="Repairs queue email"
          hint="Alerted for every new repair report (property manager / branch repairs queue). Leave empty to turn this off."
          value={repairsEmail}
          onChange={(event) => setRepairsEmail(event.target.value)}
        />
        <PhoneField
          id="on-call-phone"
          name="onCallPhone"
          label="On-call manager mobile"
          hint="Paged by SMS when an emergency repair is reported. Leave empty to turn this off."
          value={onCallPhone}
          onChange={(event) => setOnCallPhone(event.target.value)}
        />
      </fieldset>

      <div>
        <Button type="submit" loading={pending}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
