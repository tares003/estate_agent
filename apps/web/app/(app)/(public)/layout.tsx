import { Suspense, type ReactNode } from 'react';

import { SiteFooter } from '../../../components/SiteFooter.js';
import { SiteHeader } from '../../../components/SiteHeader.js';
import { SiteJsonLd } from '../../../components/SiteJsonLd.js';

// Public marketing/catalogue shell (EPIC-C). The header nav is CMS-managed
// (FR-D-7) via the async SiteHeader; the footer is the static SiteFooter. The
// skip-link in the root layout targets #main. This layout is now thin glue
// composing those tested components.
//
// EPIC-O FR-O-7: SiteJsonLd emits the site-wide RealEstateAgent (Organization) +
// WebSite structured data on every public page, behind Suspense so its
// render-time tenant read never blocks the chrome.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <SiteJsonLd />
      </Suspense>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
