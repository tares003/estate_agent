import Link from 'next/link';
import type { ReactNode } from 'react';

/** Public marketing/catalogue shell — header + primary nav + footer around the
 * page's own <main> (EPIC-C). The skip-link in the root layout targets #main. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-surface-base">
        <div className="container flex items-center justify-between py-4">
          <Link href="/" className="font-display t-heading-sm text-text-primary">
            Estate
          </Link>
          <nav aria-label="Primary">
            <ul className="flex gap-6">
              <li>
                <Link href="/properties?saleType=sale">Buy</Link>
              </li>
              <li>
                <Link href="/properties?saleType=rent">Rent</Link>
              </li>
              <li>
                <Link href="/valuation">Sell</Link>
              </li>
              <li>
                <Link href="/contact">Contact</Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      {children}
      <footer className="mt-16 border-t border-border bg-surface-raised">
        <div className="container t-body-sm text-text-secondary py-10">
          <p>
            © Estate Platform. Property details are indicative only; rent figures are shown PCM
            unless stated otherwise.
          </p>
        </div>
      </footer>
    </>
  );
}
