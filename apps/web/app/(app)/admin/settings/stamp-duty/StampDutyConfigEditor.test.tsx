// responsive-coverage: opt-out all — asserts the editor behaviour; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { DEFAULT_SDLT_CONFIG } from '../../../lib/stamp-duty.js';

const saveSdltConfig = vi.fn();
vi.mock('./actions.js', () => ({
  saveSdltConfig: (...args: unknown[]) => saveSdltConfig(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { StampDutyConfigEditor } = await import('./StampDutyConfigEditor.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StampDutyConfigEditor', () => {
  it('renders one editable rate input per standard band', () => {
    render(<StampDutyConfigEditor config={DEFAULT_SDLT_CONFIG} />);
    const inputs = screen.getAllByLabelText(/rate/i);
    expect(inputs.length).toBeGreaterThanOrEqual(DEFAULT_SDLT_CONFIG.standardBands.length);
  });

  it('shows the additional-property surcharge', () => {
    render(<StampDutyConfigEditor config={DEFAULT_SDLT_CONFIG} />);
    const surcharge = screen.getByLabelText(/surcharge/i) as HTMLInputElement;
    expect(surcharge.value).toBe(String(DEFAULT_SDLT_CONFIG.additionalPropertySurchargePercent));
  });

  it('shows a Save control', () => {
    render(<StampDutyConfigEditor config={DEFAULT_SDLT_CONFIG} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeTruthy();
  });
});
