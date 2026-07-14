'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button } from '@estate/ui';

import { requestWorkerRun, setWorkerPaused } from './actions.js';

// EPIC-U FR-U-7 / FR-U-8 + master spec §H.23 — the scheduled-tasks console table: every
// declared worker with its schedule, last run, last outcome, average runtime and next run,
// each pause-able and run-able on demand.
//
// Presentational: the server page pre-formats every cell (timestamps in the tenant's own
// zone, runtimes via the shared formatter), so this component owns only the two mutations
// and the in-flight state. A worker that is not a per-tenant loop (the outbox dispatchers)
// shows "Continuous" and no controls — see the `perTenant` note in the worker catalogue.

/** One pre-formatted console row. */
export interface ScheduledTaskView {
  id: string;
  name: string;
  description: string;
  schedule: string;
  lastRun: string;
  outcome: 'success' | 'failed' | null;
  detail: string | null;
  averageRuntime: string;
  runCount: number;
  nextRun: string;
  paused: boolean;
  runRequested: boolean;
  /** Whether this worker can be paused / run on demand for one tenant. */
  controllable: boolean;
}

function OutcomeBadge({ outcome }: { outcome: 'success' | 'failed' | null }) {
  if (outcome === null) return <span className="t-body-sm text-text-secondary">Never run</span>;
  return outcome === 'failed' ? (
    <Badge tone="danger">Failed</Badge>
  ) : (
    <Badge tone="success">Success</Badge>
  );
}

export function ScheduledTasksTable({ tasks }: { tasks: ScheduledTaskView[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(id: string, mutate: () => Promise<{ ok: boolean; errors?: unknown }>) {
    setBusyId(id);
    setError(null);
    const result = await mutate();
    setBusyId(null);
    if (result.ok) {
      router.refresh();
      return;
    }
    const [first] = (result.errors ?? []) as { message?: string }[];
    setError(first?.message ?? 'That did not work. Try again.');
  }

  function togglePause(task: ScheduledTaskView): void {
    const formData = new FormData();
    formData.set('workerId', task.id);
    formData.set('paused', task.paused ? 'false' : 'true');
    void run(task.id, () => setWorkerPaused({ ok: false }, formData));
  }

  function runNow(task: ScheduledTaskView): void {
    const formData = new FormData();
    formData.set('workerId', task.id);
    void run(task.id, () => requestWorkerRun({ ok: false }, formData));
  }

  return (
    <div className="flex flex-col gap-4">
      {error === null ? null : (
        <p role="alert" className="t-body-sm text-text-danger">
          {error}
        </p>
      )}
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-divider border-b">
            <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
              Task
            </th>
            <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
              Schedule
            </th>
            <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
              Last run
            </th>
            <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
              Outcome
            </th>
            <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
              Average runtime
            </th>
            <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
              Next run
            </th>
            <th scope="col" className="t-body-sm text-text-secondary py-2 font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-divider border-b align-top">
              <td className="py-3 pr-4">
                <div className="t-body-md font-medium">{task.name}</div>
                <div className="t-body-sm text-text-secondary max-w-[42ch]">{task.description}</div>
                {task.paused ? (
                  <div className="mt-1">
                    <Badge tone="warning">Paused</Badge>
                  </div>
                ) : null}
                {task.runRequested ? (
                  <div className="mt-1">
                    <Badge tone="info">Run queued</Badge>
                  </div>
                ) : null}
              </td>
              <td className="t-body-sm py-3 pr-4">{task.schedule}</td>
              <td className="t-body-sm py-3 pr-4">
                {task.lastRun}
                {task.detail === null ? null : (
                  <div className="t-body-sm text-text-secondary max-w-[30ch]">{task.detail}</div>
                )}
              </td>
              <td className="py-3 pr-4">
                <OutcomeBadge outcome={task.outcome} />
              </td>
              <td className="t-body-sm py-3 pr-4">
                {task.averageRuntime}
                {task.runCount === 0 ? null : (
                  <span className="text-text-secondary"> over {task.runCount}</span>
                )}
              </td>
              <td className="t-body-sm py-3 pr-4">{task.nextRun}</td>
              <td className="py-3">
                {task.controllable ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busyId === task.id}
                      onClick={() => togglePause(task)}
                    >
                      {task.paused ? 'Resume' : 'Pause'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busyId === task.id || task.paused || task.runRequested}
                      onClick={() => runNow(task)}
                    >
                      Run now
                    </Button>
                  </div>
                ) : (
                  <span className="t-body-sm text-text-secondary">Continuous</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
