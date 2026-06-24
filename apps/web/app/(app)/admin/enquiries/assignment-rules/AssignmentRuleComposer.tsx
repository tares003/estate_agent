'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError, Select, TextField } from '@estate/ui';
import {
  ASSIGNMENT_RULE_CONDITION_FIELDS,
  ASSIGNMENT_RULE_OPERATORS,
  type AssignmentRuleConditionField,
  type AssignmentRuleOperator,
} from '@estate/validators';

import { createAssignmentRule, type AssignmentRuleState } from './actions.js';

// EPIC-H FR-H-4 — the no-code rule composer. Staff name a rule, build its IF
// clause as one or more `field operator value` condition rows (AND-ed), and pick
// the THEN target (an agent or branch). On submit the conditions + assignment are
// serialised to JSON and posted to createAssignmentRule, which re-validates them
// with assignmentRuleSchema server-side (the client never bypasses validation).
// "Lead" appears as a UI label only; the entity is the canonical Enquiry.

const INITIAL_STATE: AssignmentRuleState = { ok: false };

/** Field labels for the condition picker. */
const FIELD_LABELS: Record<AssignmentRuleConditionField, string> = {
  lead_type: 'Lead type',
  status: 'Status',
  source_url: 'Source URL',
  message: 'Message',
  property: 'Property',
};

/** Operator labels for the condition picker. */
const OPERATOR_LABELS: Record<AssignmentRuleOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
};

/** Operators that compare against a value (so the value input is shown). */
const VALUE_OPERATORS: ReadonlySet<AssignmentRuleOperator> = new Set([
  'equals',
  'not_equals',
  'contains',
]);

/** An assignment target offered in the THEN picker. */
export interface AssignmentTargetOption {
  targetType: 'agent' | 'branch';
  targetId: string;
  label: string;
}

interface ConditionDraft {
  field: AssignmentRuleConditionField;
  operator: AssignmentRuleOperator;
  value: string;
}

const FIELD_OPTIONS = ASSIGNMENT_RULE_CONDITION_FIELDS.map((field) => ({
  value: field,
  label: FIELD_LABELS[field],
}));
const OPERATOR_OPTIONS = ASSIGNMENT_RULE_OPERATORS.map((operator) => ({
  value: operator,
  label: OPERATOR_LABELS[operator],
}));

function emptyCondition(): ConditionDraft {
  return { field: 'lead_type', operator: 'equals', value: '' };
}

export function AssignmentRuleComposer({ targets }: { targets: AssignmentTargetOption[] }) {
  const router = useRouter();
  const [conditions, setConditions] = useState<ConditionDraft[]>([emptyCondition()]);
  const [target, setTarget] = useState(
    targets[0] ? `${targets[0].targetType}:${targets[0].targetId}` : '',
  );
  const [name, setName] = useState('');
  const [state, setState] = useState<AssignmentRuleState>(INITIAL_STATE);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  function updateCondition(index: number, patch: Partial<ConditionDraft>): void {
    setConditions((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addCondition(): void {
    setConditions((prev) => [...prev, emptyCondition()]);
  }

  function removeCondition(index: number): void {
    setConditions((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);

    const [targetType, targetId] = target.split(':');
    const payloadConditions = conditions.map((row) => {
      const base: { field: string; operator: string; value?: string } = {
        field: row.field,
        operator: row.operator,
      };
      if (VALUE_OPERATORS.has(row.operator)) base.value = row.value;
      return base;
    });

    const fd = new FormData();
    fd.set('name', name);
    fd.set('conditions', JSON.stringify(payloadConditions));
    fd.set('assignment', JSON.stringify({ targetType, targetId }));

    const next = await createAssignmentRule(state, fd);
    setState(next);
    setPending(false);
    if (next.ok) {
      setName('');
      setConditions([emptyCondition()]);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError errors={state.errors ?? []} />

      <TextField
        id="rule-name"
        label="Rule name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="t-title-sm">If all of these are true</legend>
        {conditions.map((row, index) => (
          <div key={index} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Select
              label="Field"
              options={FIELD_OPTIONS}
              value={row.field}
              onChange={(event) =>
                updateCondition(index, {
                  field: event.target.value as AssignmentRuleConditionField,
                })
              }
            />
            <Select
              label="Operator"
              options={OPERATOR_OPTIONS}
              value={row.operator}
              onChange={(event) =>
                updateCondition(index, {
                  operator: event.target.value as AssignmentRuleOperator,
                })
              }
            />
            {VALUE_OPERATORS.has(row.operator) ? (
              <TextField
                id={`condition-value-${index}`}
                label="Value"
                value={row.value}
                onChange={(event) => updateCondition(index, { value: event.target.value })}
              />
            ) : (
              <span className="t-body-sm text-text-secondary self-center">No value needed</span>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => removeCondition(index)}
              disabled={conditions.length === 1}
            >
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button type="button" variant="secondary" onClick={addCondition}>
            Add condition
          </Button>
        </div>
      </fieldset>

      <Select
        label="Assign to"
        value={target}
        onChange={(event) => setTarget(event.target.value)}
        options={targets.map((option) => ({
          value: `${option.targetType}:${option.targetId}`,
          label: option.label,
        }))}
      />

      <div>
        <Button type="submit" loading={pending}>
          Save rule
        </Button>
      </div>
    </form>
  );
}
