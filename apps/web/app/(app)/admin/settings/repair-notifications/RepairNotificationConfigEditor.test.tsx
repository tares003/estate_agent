// responsive-coverage: opt-out all — asserts the editor behaviour; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const saveRepairNotificationConfig = vi.fn();
vi.mock('./actions.js', () => ({
  saveRepairNotificationConfig: (...args: unknown[]) => saveRepairNotificationConfig(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { RepairNotificationConfigEditor } = await import('./RepairNotificationConfigEditor.js');

beforeEach(() => {
  vi.clearAllMocks();
});

// EPIC-G FR-G-3 — the repair notification routing editor: the repairs-queue email
// (every ticket) and the on-call manager phone (emergency SMS).
describe('RepairNotificationConfigEditor', () => {
  it('pre-fills the configured repairs-queue email', () => {
    render(
      <RepairNotificationConfigEditor
        config={{ repairsEmail: 'repairs@agency.example', onCallPhone: '07700900555' }}
      />,
    );
    const emailField = screen.getByLabelText(/repairs queue email/i) as HTMLInputElement;
    expect(emailField.value).toBe('repairs@agency.example');
    expect(emailField.name).toBe('repairsEmail');
  });

  it('pre-fills the configured on-call manager phone', () => {
    render(
      <RepairNotificationConfigEditor
        config={{ repairsEmail: 'repairs@agency.example', onCallPhone: '07700900555' }}
      />,
    );
    const phoneField = screen.getByLabelText(/on-call manager/i) as HTMLInputElement;
    expect(phoneField.value).toBe('07700900555');
    expect(phoneField.name).toBe('onCallPhone');
  });

  it('renders empty fields when nothing is configured yet', () => {
    render(<RepairNotificationConfigEditor config={{ repairsEmail: null, onCallPhone: null }} />);
    expect((screen.getByLabelText(/repairs queue email/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/on-call manager/i) as HTMLInputElement).value).toBe('');
  });

  it('shows a Save control', () => {
    render(<RepairNotificationConfigEditor config={{ repairsEmail: null, onCallPhone: null }} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeTruthy();
  });
});
