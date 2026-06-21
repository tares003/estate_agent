import { Suspense } from 'react';

import { FooterReviews } from './FooterReviews.js';

// EPIC-C/D public footer chrome. Extracted from the public layout (B24) so the
// indicative-pricing / rent-frequency trust note (a trust marker, G8) stays
// unit-tested after the layout became async glue. The CMS-managed multi-column
// footer (location='footer') is a later EPIC-L render that will consume the same
// getMenu spine; this is the V1 static shell.
//
// EPIC-AC FR-AC-6: the live reviews badge is the async FooterReviews glue child,
// behind Suspense so its render-time aggregate read never blocks the footer chrome.
export function SiteFooter() {
  return (
    <footer className="bg-surface-raised border-border mt-16 border-t">
      <div className="container t-body-sm text-text-secondary flex flex-col gap-2 py-10">
        <Suspense fallback={null}>
          <FooterReviews />
        </Suspense>
        <p>
          © Estate Platform. Property details are indicative only; rent figures are shown PCM unless
          stated otherwise.
        </p>
      </div>
    </footer>
  );
}
