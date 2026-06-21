import { MortgageCalculator } from '../../app/(app)/(public)/calculators/mortgage/MortgageCalculator.js';
import { StampDutyCalculator } from '../../app/(app)/(public)/calculators/stamp-duty/StampDutyCalculator.js';
import type { CalculatorBlockData } from './calculator-options.js';

// EPIC-W FR-W-9 page-builder block (`calculator`): embeds one of the indicative
// calculators on any CMS-managed page, with an optional heading. The calculators
// are the same self-contained client components the dedicated /calculators/*
// pages use — each carries its own "not financial advice" disclosure (FR-W-10).

export function CalculatorBlock({ data }: { data: CalculatorBlockData }) {
  return (
    <section className="container py-12">
      {data.heading ? <h2 className="t-heading-lg mb-6">{data.heading}</h2> : null}
      {data.kind === 'mortgage' ? <MortgageCalculator /> : <StampDutyCalculator />}
    </section>
  );
}
