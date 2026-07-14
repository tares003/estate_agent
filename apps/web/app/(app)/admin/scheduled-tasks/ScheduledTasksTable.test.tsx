// responsive-coverage: opt-out all — asserts the table's controls + mutation wiring;
// layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ScheduledTasksTable, type ScheduledTaskView } from './ScheduledTasksTable.js';

// EPIC-U FR-U-7 / FR-U-8 + master spec §H.23 — the console table. Pins that the controls
// are offered ONLY for workers a tenant can actually control, that pause/resume and Run-now
// call the audited server actions with the right worker, and that a failure is surfaced
// rather than swallowed.

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const setWorkerPaused = vi.fn();
const requestWorkerRun = vi.fn();
vi.mock('./actions.js', () => ({
  setWorkerPaused: (...args: unknown[]) => setWorkerPaused(...args),
  requestWorkerRun: (...args: unknown[]) => requestWorkerRun(...args),
}));

function task(over: Partial<ScheduledTaskView> = {}): ScheduledTaskView {
  return {
    id: 'saved_search_daily',
    name: 'Saved-search alerts (daily)',
    description: 'Emails one daily digest of new matches.',
    schedule: '07:00 tenant-local',
    lastRun: '1 Jul 2026, 07:00',
    outcome: 'success',
    detail: 'emailed 3',
    averageRuntime: '1.4s',
    runCount: 2,
    nextRun: '2 Jul 2026, 07:00',
    paused: false,
    runRequested: false,
    controllable: true,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setWorkerPaused.mockResolvedValue({ ok: true });
  requestWorkerRun.mockResolvedValue({ ok: true });
});

describe('ScheduledTasksTable', () => {
  it('renders the §H.23 columns for each worker', () => {
    render(<ScheduledTasksTable tasks={[task()]} />);

    expect(screen.getByText('Saved-search alerts (daily)')).toBeInTheDocument();
    expect(screen.getByText('07:00 tenant-local')).toBeInTheDocument();
    expect(screen.getByText('1 Jul 2026, 07:00')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('1.4s')).toBeInTheDocument();
    expect(screen.getByText('2 Jul 2026, 07:00')).toBeInTheDocument();
  });

  it('shows a worker that has never run as such, rather than as a failure', () => {
    render(
      <ScheduledTasksTable
        tasks={[task({ outcome: null, lastRun: '—', averageRuntime: '—', runCount: 0 })]}
      />,
    );

    expect(screen.getByText('Never run')).toBeInTheDocument();
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
  });

  it('surfaces a FAILED last run with its detail (the console must show breakage)', () => {
    render(<ScheduledTasksTable tasks={[task({ outcome: 'failed', detail: 'SMTP timeout' })]} />);

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('SMTP timeout')).toBeInTheDocument();
  });

  it('pauses a worker through the audited action, then refreshes (FR-U-8)', async () => {
    const user = userEvent.setup();
    render(<ScheduledTasksTable tasks={[task()]} />);

    await user.click(screen.getByRole('button', { name: 'Pause' }));

    await waitFor(() => expect(setWorkerPaused).toHaveBeenCalledTimes(1));
    const formData = setWorkerPaused.mock.calls[0]![1] as FormData;
    expect(formData.get('workerId')).toBe('saved_search_daily');
    expect(formData.get('paused')).toBe('true');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('offers Resume — and NOT Run now — while a worker is paused (a paused worker will not run)', () => {
    render(<ScheduledTasksTable tasks={[task({ paused: true })]} />);

    expect(screen.getByRole('button', { name: 'Resume' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Run now' })).toBeDisabled();
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('requests an out-of-cadence run, then refreshes (§H.23 "Run now")', async () => {
    const user = userEvent.setup();
    render(<ScheduledTasksTable tasks={[task()]} />);

    await user.click(screen.getByRole('button', { name: 'Run now' }));

    await waitFor(() => expect(requestWorkerRun).toHaveBeenCalledTimes(1));
    const formData = requestWorkerRun.mock.calls[0]![1] as FormData;
    expect(formData.get('workerId')).toBe('saved_search_daily');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('shows a queued run and does not let it be requested twice', () => {
    render(<ScheduledTasksTable tasks={[task({ runRequested: true })]} />);

    expect(screen.getByText('Run queued')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run now' })).toBeDisabled();
  });

  it('offers NO controls for a continuous dispatcher (a Pause button that did nothing would lie)', () => {
    render(<ScheduledTasksTable tasks={[task({ id: 'email_send', controllable: false })]} />);

    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run now' })).not.toBeInTheDocument();
    expect(screen.getByText('Continuous')).toBeInTheDocument();
  });

  it('surfaces a denied mutation instead of silently doing nothing', async () => {
    const user = userEvent.setup();
    setWorkerPaused.mockResolvedValue({
      ok: false,
      errors: [{ message: 'You do not have permission to change scheduled tasks.' }],
    });
    render(<ScheduledTasksTable tasks={[task()]} />);

    await user.click(screen.getByRole('button', { name: 'Pause' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission');
    expect(refresh).not.toHaveBeenCalled();
  });
});
