'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError, FormSuccess, NumberField } from '@estate/ui';
import type { RepairSlaConfigInput } from '@estate/validators';

import { saveRepairSlaConfig, type RepairSlaConfigActionState } from './actions.js';

// EPIC-G FR-G-5 / FR-G-9 (audit finding repair-urgency-sla-not-configurable) — the
// repair SLA editor. Two groups: the master spec §G.4 per-urgency SLA targets (the
// three responsive urgencies in hours, non-urgent in working days — §G.4's own
// units), and the FR-G-9 SLA-breach-badge thresholds. Posts named fields to the
// audited, setting.manage-gated saveRepairSlaConfig action; the schema validates
// server-side (breach stays fixed at 100% — not an editable threshold). Token-driven
// (G7); every control has a real label (G9).

const INITIAL_STATE: RepairSlaConfigActionState = { ok: false };

/** A controlled numeric field value, keyed by the posted field name. */
type FieldState = Record<keyof RepairSlaConfigInput, string>;

function fieldsFor(config: RepairSlaConfigInput): FieldState {
  return {
    emergencyTargetHours: String(config.emergencyTargetHours),
    urgentTargetHours: String(config.urgentTargetHours),
    standardTargetHours: String(config.standardTargetHours),
    lowTargetWorkingDays: String(config.lowTargetWorkingDays),
    dueSoonThresholdPercent: String(config.dueSoonThresholdPercent),
    atRiskThresholdPercent: String(config.atRiskThresholdPercent),
  };
}

export function RepairSlaConfigEditor({ config }: { config: RepairSlaConfigInput }) {
  const [state, formAction, pending] = useActionState(saveRepairSlaConfig, INITIAL_STATE);
  const [fields, setFields] = useState<FieldState>(() => fieldsFor(config));
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  const set = (name: keyof FieldState, value: string): void => {
    setFields((current) => ({ ...current, [name]: value }));
  };

  const field = (name: keyof FieldState, label: string, hint: string, min: number, max: number) => (
    <NumberField
      id={name}
      name={name}
      label={label}
      hint={hint}
      min={min}
      max={max}
      step={1}
      value={fields[name]}
      onChange={(event) => set(name, event.target.value)}
    />
  );

  return (
    <form action={formAction} className="flex max-w-[40rem] flex-col gap-8">
      <FormError errors={state.errors ?? []} />
      {state.ok ? <FormSuccess title="Repair SLA settings saved." /> : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="t-body-md font-semibold">SLA targets</legend>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          How long a report of each urgency has before it breaches. The clock starts when the report
          is submitted.
        </p>
        {field(
          'emergencyTargetHours',
          'Emergency target (hours)',
          'Immediate risk to life, health or property — contractor on site within this many hours.',
          1,
          8760,
        )}
        {field(
          'urgentTargetHours',
          'Urgent target (hours)',
          'Significant disruption — contractor on site within this many hours.',
          1,
          8760,
        )}
        {field(
          'standardTargetHours',
          'Standard target (hours)',
          'Affects use but is not critical — acknowledged within this many hours.',
          1,
          8760,
        )}
        {field(
          'lowTargetWorkingDays',
          'Non-urgent target (working days)',
          'Cosmetic or minor — acknowledged within this many working days (weekends are skipped).',
          1,
          260,
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="t-body-md font-semibold">Breach-risk badge thresholds</legend>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          When the SLA badge in the repairs inbox changes, as a percentage of the target elapsed. A
          ticket below the first threshold reads &ldquo;On track&rdquo;; at 100% of its target it
          reads &ldquo;Breached&rdquo;.
        </p>
        {field(
          'dueSoonThresholdPercent',
          'Due soon above (%)',
          'Past this share of the target elapsed, the badge reads “Due soon”.',
          1,
          99,
        )}
        {field(
          'atRiskThresholdPercent',
          'At risk above (%)',
          'Past this share of the target elapsed, the badge reads “At risk”. Must be higher than the due-soon threshold.',
          1,
          99,
        )}
      </fieldset>

      <div>
        <Button type="submit" loading={pending}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
