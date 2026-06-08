import { it } from 'vitest';
import { makeRuleTester } from './_rule-tester.js';
import rule from './g12-pack-entitlement.js';

// G12 — Pack-entitlement guard (CLAUDE.md §9 EPIC-AD / PRODUCT.md §5a).
//
// Any file that references a non-core pack slug must also gate that capability:
// a requirePack(...) / isPackEnabled(...) call, a <RequirePack> element, or an
// explicit `// pack: core` always-on declaration. A file that references a
// pack-scoped slug with no gate is a fail-closed violation.
it('G12 pack-entitlement: rejects pack-slug references with no gate, allows gated/core', () => {
  makeRuleTester().run('@estate/pack-entitlement', rule, {
    valid: [
      // requirePack(...) call both references the slug AND provides the gate
      {
        code: "export async function listVendorComparables(){ await requirePack('sales_plus'); return []; }",
      },
      // isPackEnabled(...) call is a valid gate
      {
        code: "export async function newHomesFeed(){ if (await isPackEnabled('new_homes')) return []; return []; }",
      },
      // <RequirePack> JSX element gates the route
      {
        code: 'export function VendorPage(){ return <RequirePack pack="sales_plus"><div/></RequirePack>; }',
      },
      // explicit `// pack: core` always-on declaration
      {
        code: '// pack: core\nexport async function listProperties(){ return []; }',
      },
      // no pack slug referenced at all — nothing to gate
      {
        code: 'export async function listProperties(){ return []; }',
      },
    ],
    invalid: [
      // references the 'sales_plus' slug but provides no gate — fail closed
      {
        code: "const PACK='sales_plus'; export async function listVendorComparables(){ return []; }",
        errors: [{ messageId: 'missingPackGate' }],
      },
    ],
  });
});
