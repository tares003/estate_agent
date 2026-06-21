import type { Metadata } from 'next';
import Link from 'next/link';

import { getRequestOrigin } from '../../lib/tenant.js';

// EPIC-W calculators hub — a discoverable index linking the indicative
// calculators (also reachable from the primary nav). INDICATIVE ONLY
// (PRODUCT.md §9); each calculator carries its own "not financial advice"
// disclosure.

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();
  const url = `${origin}/calculators`;
  const title = 'Calculators';
  const description =
    'Indicative mortgage repayment and Stamp Duty calculators. For guidance only — not financial advice.';
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

const CALCULATORS = [
  {
    href: '/calculators/mortgage',
    title: 'Mortgage calculator',
    description: 'Estimate your indicative monthly repayment, total interest and loan-to-value.',
  },
  {
    href: '/calculators/stamp-duty',
    title: 'Stamp duty calculator',
    description: 'Estimate the indicative Stamp Duty (SDLT) on a residential purchase.',
  },
];

export default function CalculatorsPage() {
  return (
    <main id="main" className="container py-12">
      <header className="flex flex-col gap-2">
        <h1 className="t-display-sm">Calculators</h1>
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          Indicative tools to help you plan — for guidance only, not financial advice.
        </p>
      </header>
      <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {CALCULATORS.map((calculator) => (
          <li key={calculator.href}>
            <Link
              href={calculator.href}
              className="border-divider bg-surface-raised flex h-full flex-col gap-2 rounded-lg border p-6"
            >
              <span className="t-heading-sm text-brand-primary">{calculator.title}</span>
              <span className="t-body-md text-text-secondary">{calculator.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
