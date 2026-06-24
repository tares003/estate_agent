import { Suspense, type ReactNode } from 'react';

import { CookieBanner } from '../../../components/CookieBanner.js';
import { SiteFooter } from '../../../components/SiteFooter.js';
import { SiteHeader } from '../../../components/SiteHeader.js';
import { SiteJsonLd } from '../../../components/SiteJsonLd.js';
import { readConsentDecision } from '../lib/cookie-consent-server.js';

// Public marketing/catalogue shell (EPIC-C). The header nav is CMS-managed
// (FR-D-7) via the async SiteHeader; the footer is the static SiteFooter. The
// skip-link in the root layout targets #main. This layout is now thin glue
// composing those tested components.
//
// EPIC-O FR-O-7: SiteJsonLd emits the site-wide RealEstateAgent (Organization) +
// WebSite structured data on every public page, behind Suspense so its
// render-time tenant read never blocks the chrome.
//
// EPIC-C FR-C-12: the CookieBanner is part of the public chrome. The layout reads
// the recorded consent decision server-side and hands it to the banner, which
// shows itself only for an undecided visitor (no decision cookie) and persists
// the choice through its server action.
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const consentDecision = await readConsentDecision();
  return (
    <>
      <Suspense fallback={null}>
        <SiteJsonLd />
      </Suspense>
      <SiteHeader />
      {children}
      <SiteFooter />
      <CookieBanner initialDecision={consentDecision} />
    </>
  );
}
