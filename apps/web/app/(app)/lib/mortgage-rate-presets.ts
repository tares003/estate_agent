// EPIC-W FR-W-8 — the mortgage rate preset read model. Returns the tenant's curated
// presets (ordered for the dropdown) as plain { id, label, annualRatePercent,
// termYears } records; an empty list when none are configured (the calculator then
// simply renders no preset dropdown). Tenant isolation is applied by the caller via
// withTenant (RLS); the structural reader keeps this DB-free for unit tests — a
// Prisma tx satisfies it.

/** A preset as offered in the dropdown (the persisted id + the applied figures). */
export interface MortgageRatePreset {
  /** The persisted preset id (the dropdown option value). */
  id: string;
  /** Display label (e.g. "2-year fixed"). */
  label: string;
  /** Illustrative annual interest rate as a percentage. */
  annualRatePercent: number;
  /** The preset's term in whole years. */
  termYears: number;
}

interface PresetRow {
  id: string;
  label: string;
  annualRatePercent: number;
  termYears: number;
}

/** Minimal read surface the loader needs (a Prisma tx satisfies it). */
export interface MortgageRatePresetReader {
  mortgageRatePreset: {
    findMany(args?: {
      select?: { id: true; label: true; annualRatePercent: true; termYears: true };
      orderBy?: unknown;
    }): Promise<PresetRow[]>;
  };
}

/**
 * Load the tenant's mortgage rate presets (FR-W-8), ordered by sort position then
 * label, as plain records. Returns an empty list when none are configured. The
 * caller scopes the read to the tenant (withTenant / RLS).
 */
export async function loadMortgageRatePresets(
  reader: MortgageRatePresetReader,
): Promise<MortgageRatePreset[]> {
  const rows = await reader.mortgageRatePreset.findMany({
    select: { id: true, label: true, annualRatePercent: true, termYears: true },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    annualRatePercent: row.annualRatePercent,
    termYears: row.termYears,
  }));
}
