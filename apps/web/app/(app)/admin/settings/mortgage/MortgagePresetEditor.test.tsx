// responsive-coverage: opt-out all — asserts the editor behaviour; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const saveMortgageRatePresets = vi.fn();
vi.mock('./presets-actions.js', () => ({
  saveMortgageRatePresets: (...args: unknown[]) => saveMortgageRatePresets(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { MortgagePresetEditor } = await import('./MortgagePresetEditor.js');

const PRESETS = [{ id: 'p1', label: '2-year fixed', annualRatePercent: 4.79, termYears: 25 }];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MortgagePresetEditor', () => {
  it('lists the existing presets', () => {
    render(<MortgagePresetEditor presets={PRESETS} />);
    expect((screen.getByDisplayValue('2-year fixed') as HTMLInputElement)).toBeInTheDocument();
  });

  it('can add a new preset row', () => {
    render(<MortgagePresetEditor presets={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /add preset/i }));
    expect(screen.getAllByLabelText(/preset name/i).length).toBe(1);
  });

  it('can remove a preset row', () => {
    render(<MortgagePresetEditor presets={PRESETS} />);
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(screen.queryByDisplayValue('2-year fixed')).not.toBeInTheDocument();
  });

  it('shows a Save control', () => {
    render(<MortgagePresetEditor presets={PRESETS} />);
    expect(screen.getByRole('button', { name: /save presets/i })).toBeTruthy();
  });

  it('serialises the presets into the hidden field for the action', () => {
    const { container } = render(<MortgagePresetEditor presets={PRESETS} />);
    const hidden = container.querySelector('input[name="presets"]') as HTMLInputElement;
    expect(hidden).not.toBeNull();
    expect(JSON.parse(hidden.value)).toEqual([
      { label: '2-year fixed', annualRatePercent: 4.79, termYears: 25 },
    ]);
  });
});
