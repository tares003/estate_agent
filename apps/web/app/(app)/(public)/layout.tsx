import type { ReactNode } from 'react';

import { SiteFooter } from '../../../components/SiteFooter.js';
import { SiteHeader } from '../../../components/SiteHeader.js';

// Public marketing/catalogue shell (EPIC-C). The header nav is CMS-managed
// (FR-D-7) via the async SiteHeader; the footer is the static SiteFooter. The
// skip-link in the root layout targets #main. This layout is now thin glue
// composing those tested components.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
