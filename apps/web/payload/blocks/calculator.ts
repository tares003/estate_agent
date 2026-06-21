import type { Block } from 'payload';

// CMS authoring schema for `calculator` (EPIC-W FR-W-9) — mirrors
// calculatorBlockSchema in components/blocks/calculator-options.ts (enforced by
// blocks.test.ts). Lets an editor drop either indicative calculator onto a page.
export const calculatorBlock: Block = {
  slug: 'calculator',
  interfaceName: 'CalculatorBlock',
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'mortgage',
      options: [
        { label: 'Mortgage repayment', value: 'mortgage' },
        { label: 'Stamp duty (SDLT)', value: 'stamp_duty' },
      ],
    },
    { name: 'heading', type: 'text' },
  ],
};
