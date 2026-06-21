import { z } from 'zod';

// EPIC-W FR-W-9 — the calculator block's data schema, kept in its own (UI-free)
// module so the node-env parity test (payload/blocks/blocks.test.ts) can import it
// without pulling the renderer's client-component / @estate/ui deps — the same
// split as property-grid-options.ts.

/** The calculators an editor can embed via the page builder. */
export const CALCULATOR_KINDS = ['mortgage', 'stamp_duty'] as const;

export const calculatorBlockSchema = z.object({
  /** Which calculator to embed. */
  kind: z.enum(CALCULATOR_KINDS),
  /** Optional heading rendered above the calculator. */
  heading: z.string().optional(),
});

export type CalculatorKind = (typeof CALCULATOR_KINDS)[number];
export type CalculatorBlockData = z.infer<typeof calculatorBlockSchema>;
