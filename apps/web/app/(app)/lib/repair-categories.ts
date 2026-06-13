import { DEFAULT_REPAIR_CATEGORIES } from '@estate/validators';

// EPIC-G repair categories (FR-G-4, master spec §G.3) — the read model + the
// public-form option mapping. Pure query-shaping over a STRUCTURAL Prisma client
// (DB-free to unit-test); the live query runs tenant-scoped (RLS) via withTenant.
// repairCategoryOptions falls back to the §G.3 defaults so a tenant that has not
// customised its catalogue still shows the §G.1-step-3 dropdown.

/** A visible category row (the columns the public dropdown needs). */
export interface RepairCategoryRow {
  slug: string;
  label: string;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface RepairCategoryReader {
  repairCategory: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
    }): Promise<RepairCategoryRow[]>;
  };
}

/** List the tenant's visible repair categories, in sort order. */
export async function listVisibleRepairCategories(
  db: RepairCategoryReader,
): Promise<RepairCategoryRow[]> {
  return db.repairCategory.findMany({
    where: { visible: true },
    orderBy: { sortOrder: 'asc' },
  });
}

/** Map categories to {value,label} options, or the §G.3 defaults when empty. */
export function repairCategoryOptions(
  rows: readonly RepairCategoryRow[],
): Array<{ value: string; label: string }> {
  const source = rows.length > 0 ? rows : DEFAULT_REPAIR_CATEGORIES;
  return source.map((category) => ({ value: category.slug, label: category.label }));
}
