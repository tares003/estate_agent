import { withTenant } from '@estate/db';

import { getDb } from '../../../lib/db.js';
import {
  loadMortgageRateConfig,
  type MortgageRateConfigReader,
} from '../../../lib/mortgage-rate-config.js';
import { requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';
import { MortgageRateConfigEditor } from './MortgageRateConfigEditor.js';

// EPIC-W FR-W-7 — the mortgage-default config admin. Gates on `calculator_config.manage`
// (RBAC fail-closed — the same permission as the SDLT band editor), resolves the
// tenant, loads the stored defaults (or the engine default) inside the tenant RLS
// scope, and renders the editor. The read model + the editor are unit-tested, so this
// route stays a thin composition. Renders inside the admin shell's `main` landmark.

export const dynamic = 'force-dynamic';

export default async function MortgageRateConfigPage() {
  await requireStaffPermission('calculator_config.manage');

  const tenantId = await getCurrentTenantId();
  const config = await withTenant(getDb(), tenantId, (tx) =>
    loadMortgageRateConfig(tx as unknown as MortgageRateConfigReader),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="t-display-sm">Mortgage defaults</h1>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          The illustrative defaults the public mortgage calculator pre-fills. Indicative only — not
          financial advice. Keep the last-reviewed date honest. Changes are recorded in the audit
          log.
        </p>
      </div>
      <MortgageRateConfigEditor config={config} />
    </div>
  );
}
