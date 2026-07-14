// responsive-coverage: opt-out all — asserts the editor behaviour; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DEFAULT_REPAIR_SLA_CONFIG } from '@estate/validators';

const saveRepairSlaConfig = vi.fn();
vi.mock('./actions.js', () => ({
  saveRepairSlaConfig: (...args: unknown[]) => saveRepairSlaConfig(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { RepairSlaConfigEditor } = await import('./RepairSlaConfigEditor.js');

beforeEach(() => {
  vi.clearAllMocks();
});

// EPIC-G FR-G-5 / FR-G-9 — the repair SLA config editor: one target per urgency
// (§G.4) plus the two badge thresholds (FR-G-9). Fields post named values to the
// audited, setting.manage-gated saveRepairSlaConfig action.
describe('RepairSlaConfigEditor', () => {
  it('pre-fills each §G.4 urgency target from the tenant config', () => {
    render(<RepairSlaConfigEditor config={DEFAULT_REPAIR_SLA_CONFIG} />);

    const emergency = screen.getByLabelText(/emergency/i) as HTMLInputElement;
    expect(emergency.value).toBe('4');
    expect(emergency.name).toBe('emergencyTargetHours');

    const urgent = screen.getByLabelText(/^urgent/i) as HTMLInputElement;
    expect(urgent.value).toBe('24');
    expect(urgent.name).toBe('urgentTargetHours');

    const standard = screen.getByLabelText(/standard/i) as HTMLInputElement;
    expect(standard.value).toBe('48');
    expect(standard.name).toBe('standardTargetHours');

    const low = screen.getByLabelText(/non-urgent/i) as HTMLInputElement;
    expect(low.value).toBe('5');
    expect(low.name).toBe('lowTargetWorkingDays');
  });

  it('pre-fills the FR-G-9 badge thresholds', () => {
    render(<RepairSlaConfigEditor config={DEFAULT_REPAIR_SLA_CONFIG} />);

    const dueSoon = screen.getByLabelText(/due soon/i) as HTMLInputElement;
    expect(dueSoon.value).toBe('50');
    expect(dueSoon.name).toBe('dueSoonThresholdPercent');

    const atRisk = screen.getByLabelText(/at risk/i) as HTMLInputElement;
    expect(atRisk.value).toBe('75');
    expect(atRisk.name).toBe('atRiskThresholdPercent');
  });

  it('reflects a tenant-customised configuration', () => {
    render(
      <RepairSlaConfigEditor
        config={{ ...DEFAULT_REPAIR_SLA_CONFIG, emergencyTargetHours: 2, lowTargetWorkingDays: 10 }}
      />,
    );
    expect((screen.getByLabelText(/emergency/i) as HTMLInputElement).value).toBe('2');
    expect((screen.getByLabelText(/non-urgent/i) as HTMLInputElement).value).toBe('10');
  });

  it('shows a Save control', () => {
    render(<RepairSlaConfigEditor config={DEFAULT_REPAIR_SLA_CONFIG} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeTruthy();
  });
});
