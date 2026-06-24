'use client';

import { useState } from 'react';
import { Badge, Button, Checkbox, Select, TextField } from '@estate/ui';
import {
  evaluateAssignmentRules,
  type AssignmentRule,
  type SampleEnquiry,
} from '@estate/validators';

import type { AssignmentRuleRow } from './assignment-rules-query.js';

// EPIC-H FR-H-4 — the rule-tester. Before committing a rule set, staff build a
// sample enquiry (lead_type, status, source URL, message, has-property) and run
// the SAME pure evaluator the runtime router uses (evaluateAssignmentRules,
// top-down first-match-wins). The result names the winning rule and its target,
// or reports that the enquiry would stay unassigned — so the order is visibly
// correct before save. "Lead" is a UI label only; the entity is the Enquiry.

/** Enquiry-type options shown in the tester (canonical LeadType enum values). */
const ENQUIRY_TYPE_OPTIONS = [
  { value: 'buyer_enquiry', label: 'Buyer enquiry' },
  { value: 'viewing_request', label: 'Viewing request' },
  { value: 'valuation_request', label: 'Valuation request' },
  { value: 'landlord_enquiry', label: 'Landlord enquiry' },
  { value: 'tenant_enquiry', label: 'Tenant enquiry' },
  { value: 'repair_request', label: 'Repair request' },
  { value: 'general_contact', label: 'General contact' },
  { value: 'newsletter_signup', label: 'Newsletter signup' },
];

/** Status options shown in the tester (canonical EnquiryStatus enum values). */
const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'viewing_booked', label: 'Viewing booked' },
  { value: 'valuation_booked', label: 'Valuation booked' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
  { value: 'archived', label: 'Archived' },
];

interface TesterResult {
  matched: boolean;
  ruleName: string | null;
  targetType: string | null;
  targetId: string | null;
}

/** Strip the persisted-row fields down to the AssignmentRule the evaluator needs. */
function toRule(row: AssignmentRuleRow): AssignmentRule {
  return { ruleName: row.name, conditions: row.conditions, assignment: row.assignment };
}

export function AssignmentRuleTester({ rules }: { rules: AssignmentRuleRow[] }) {
  const [enquiryType, setEnquiryType] = useState('buyer_enquiry');
  const [status, setStatus] = useState('new');
  const [sourceUrl, setSourceUrl] = useState('');
  const [message, setMessage] = useState('');
  const [hasProperty, setHasProperty] = useState(true);
  const [result, setResult] = useState<TesterResult | null>(null);

  function runTest(): void {
    const sample: SampleEnquiry = {
      enquiryType,
      status,
      sourceUrl: sourceUrl.trim() === '' ? null : sourceUrl.trim(),
      message,
      hasProperty,
    };
    // Only enabled rules participate in routing, in evaluation (position) order.
    const active = rules.filter((row) => row.isEnabled).map(toRule);
    const outcome = evaluateAssignmentRules(active, sample);
    const winner = outcome.matchedIndex >= 0 ? active[outcome.matchedIndex] : undefined;
    setResult({
      matched: outcome.matched,
      ruleName: winner?.ruleName ?? null,
      targetType: outcome.assignment?.targetType ?? null,
      targetId: outcome.assignment?.targetId ?? null,
    });
  }

  return (
    <section aria-labelledby="rule-tester-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 id="rule-tester-heading" className="t-title-md">
          Test a sample lead
        </h2>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          Build a sample enquiry and see which rule would route it. Rules are evaluated top to
          bottom — the first one that matches wins.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Lead type"
          options={ENQUIRY_TYPE_OPTIONS}
          value={enquiryType}
          onChange={(event) => setEnquiryType(event.target.value)}
        />
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        />
        <TextField
          id="tester-source-url"
          label="Source URL"
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
        />
        <TextField
          id="tester-message"
          label="Message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>

      <Checkbox
        label="Attached to a property"
        checked={hasProperty}
        onChange={(event) => setHasProperty(event.target.checked)}
      />

      <div>
        <Button type="button" onClick={runTest}>
          Test sample lead
        </Button>
      </div>

      <div
        data-testid="rule-tester-result"
        role="status"
        aria-live="polite"
        className="border-divider rounded-lg border p-4"
      >
        {result === null ? (
          <p className="t-body-sm text-text-secondary">
            Run the test to see the routing outcome.
          </p>
        ) : result.matched ? (
          <div className="flex flex-col gap-2">
            <Badge tone="success">Matched</Badge>
            <p className="t-body-md">
              Routed by <strong>{result.ruleName}</strong> to {result.targetType}{' '}
              <code>{result.targetId}</code>.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Badge tone="warning">No match</Badge>
            <p className="t-body-md">
              No rule matched — this lead would stay unassigned for manual routing.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
