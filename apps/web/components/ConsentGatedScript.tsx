import type { ReactNode } from 'react';

import { readConsentDecision } from '../app/(app)/lib/cookie-consent-server.js';
import { isCategoryGranted } from '../app/(app)/lib/cookie-consent.js';
import type { CookieConsentCategory } from '../app/(app)/lib/cookie-consent.js';

/** A non-essential consent category that can gate a script. */
type GatedCategory = Exclude<CookieConsentCategory, 'necessary'>;

export interface ConsentGatedScriptProps {
  /** The category whose consent must be granted before the children render. */
  category: GatedCategory;
  /** The non-essential script(s) to withhold until consent is granted. */
  children: ReactNode;
}

/**
 * EPIC-C FR-C-12 — gate the loading of non-essential scripts until consent is
 * granted. An async Server Component: it reads the recorded consent decision and
 * renders its `children` (e.g. an analytics / marketing / preferences `<script>`)
 * ONLY when the visitor has opted into that category. Before any decision, and
 * for any rejected category, it renders nothing — so the bytes never reach the
 * page pre-consent, satisfying "scripts blocked pre-consent, loaded post-consent".
 *
 * Analytics/marketing tooling is deferred from V1 (CLAUDE.md) — this is the
 * mechanism, ready for a provider to be dropped inside it behind the gate.
 */
export async function ConsentGatedScript({
  category,
  children,
}: ConsentGatedScriptProps): Promise<ReactNode> {
  const decision = await readConsentDecision();
  if (!isCategoryGranted(decision, category)) {
    return null;
  }
  return children;
}
