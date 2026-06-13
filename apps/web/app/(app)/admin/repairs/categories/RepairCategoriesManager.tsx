'use client';

import { useRouter } from 'next/navigation';
import { Badge, Button } from '@estate/ui';

import { repairUrgencyDisplay } from '../repair-display.js';
import { seedRepairCategories, setRepairCategoryVisibility } from './actions.js';

// EPIC-G repair categories admin (FR-G-4). Presentational table over the managed
// categories; the seed prompt shows only when the catalogue is empty, and each
// row offers a one-click visibility toggle. Mutations call the audited server
// actions and refresh the RSC tree. Relabel / reorder / custom-create are a later
// refinement.

export interface ManagedCategory {
  id: string;
  slug: string;
  label: string;
  defaultUrgency: string;
  visible: boolean;
}

export function RepairCategoriesManager({ categories }: { categories: ManagedCategory[] }) {
  const router = useRouter();

  async function seed(): Promise<void> {
    const result = await seedRepairCategories({ ok: false }, new FormData());
    if (result.ok) router.refresh();
  }

  async function toggle(slug: string, nextVisible: boolean): Promise<void> {
    const formData = new FormData();
    formData.set('slug', slug);
    formData.set('visible', nextVisible ? 'true' : 'false');
    const result = await setRepairCategoryVisibility({ ok: false }, formData);
    if (result.ok) router.refresh();
  }

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          No categories yet. Add the {18} standard categories to get started — you can hide any you
          don’t use.
        </p>
        <Button type="button" onClick={() => void seed()}>
          Add the default categories
        </Button>
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-divider border-b">
          <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
            Category
          </th>
          <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
            Default urgency
          </th>
          <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
            Shown
          </th>
          <th scope="col" className="t-body-sm text-text-secondary py-2 font-semibold">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {categories.map((category) => {
          const urgency = repairUrgencyDisplay(category.defaultUrgency);
          return (
            <tr key={category.id} className="border-divider border-b">
              <td className="t-body-md py-3 pr-4">{category.label}</td>
              <td className="py-3 pr-4">
                <Badge tone={urgency.tone}>{urgency.label}</Badge>
              </td>
              <td className="py-3 pr-4">
                {category.visible ? (
                  <Badge tone="success">Shown</Badge>
                ) : (
                  <Badge tone="neutral">Hidden</Badge>
                )}
              </td>
              <td className="py-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void toggle(category.slug, !category.visible)}
                >
                  {category.visible ? 'Hide' : 'Show'}
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
