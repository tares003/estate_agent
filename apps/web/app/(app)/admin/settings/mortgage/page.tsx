import { withTenant } from '@estate/db';

import { getDb } from '../../../lib/db.js';
import {
  loadMortgageRateConfig,
  type MortgageRateConfigReader,
} from '../../../lib/mortgage-rate-config.js';
import {
  loadMortgageRatePresets,
  type MortgageRatePresetReader,
} from '../../../lib/mortgage-rate-presets.js';
import { requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';
import { MortgageRateConfigEditor } from './MortgageRateConfigEditor.js';
import { MortgagePresetEditor } from './MortgagePresetEditor.js';

// EPIC-W FR-W-7/8 — the mortgage calculator config admin. Gates on
// `calculator_config.manage` (RBAC fail-closed — the same permission as the SDLT band
// editor), resolves the tenant, loads the stored defaults (or the engine default) and
// the admin-managed rate presets inside the tenant RLS scope, and renders both editors.
// The read models + editors are unit-tested, so this route stays a thin composition.
// Renders inside the admin shell's `main` landmark.

export const dynamic = 'force-dynamic';

export default async function MortgageRateConfigPage() {
  await requireStaffPermission('calculator_config.manage');

  const tenantId = await getCurrentTenantId();
  const { config, presets } = await withTenant(getDb(), tenantId, async (tx) => ({
    config: await loadMortgageRateConfig(tx as unknown as MortgageRateConfigReader),
    presets: await loadMortgageRatePresets(tx as unknown as MortgageRatePresetReader),
  }));

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="t-display-sm">Mortgage defaults</h1>
          <p className="t-body-sm text-text-secondary max-w-[55ch]">
            The illustrative defaults the public mortgage calculator pre-fills. Indicative only —
            not financial advice. Keep the last-reviewed date honest. Changes are recorded in the
            audit log.
          </p>
        </div>
        <MortgageRateConfigEditor config={config} />
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="t-heading-lg">Rate presets</h2>
          <p className="t-body-sm text-text-secondary max-w-[55ch]">
            Named rate snapshots (e.g. 2-year fixed, 5-year fixed) a visitor can apply with one tap
            in the calculator. Indicative only — not financial advice. Changes are recorded in the
            audit log.
          </p>
        </div>
        <MortgagePresetEditor presets={presets} />
      </section>
    </div>
  );
}
