import { getDb } from '../app/(app)/lib/db.js';
import { organizationJsonLd, webSiteJsonLd } from '../app/(app)/lib/seo.js';
import {
  getCurrentTenantId,
  getRequestOrigin,
  getTenantName,
  type PlatformTenantReader,
} from '../app/(app)/lib/tenant.js';

// EPIC-O FR-O-7 (site-wide structured data, master spec §O.3): async server-
// component GLUE — it resolves the current tenant + request origin, reads the
// agency name from the operator-owned platform_tenants registry (NOT under RLS,
// so read on the base client by id — not inside withTenant), and emits the
// RealEstateAgent (Organization) + WebSite JSON-LD on every public page.
//
// Like SiteHeader / FooterReviews it touches the request + DB, so it is verified
// by runtime smoke / e2e and excluded from unit coverage — the testable parts are
// the pure organizationJsonLd / webSiteJsonLd builders + the structural
// getTenantName reader. Resilient: any failure to resolve the tenant / name
// renders nothing, so the page chrome never depends on it. The per-entity
// property JSON-LD (RealEstateListing + BreadcrumbList) is emitted on the detail
// route itself; this covers the site-wide entities.

async function resolveSiteJsonLd(): Promise<Record<string, unknown>[]> {
  try {
    const tenantId = await getCurrentTenantId();
    const origin = await getRequestOrigin();
    const name = await getTenantName(getDb() as unknown as PlatformTenantReader, tenantId);
    if (!name) return [];
    return [organizationJsonLd(name, origin), webSiteJsonLd(name, origin)];
  } catch {
    return [];
  }
}

export async function SiteJsonLd() {
  const jsonLd = await resolveSiteJsonLd();
  return (
    <>
      {jsonLd.map((ld, index) => (
        <script
          key={index}
          type="application/ld+json"
          // Server-rendered, non-interactive JSON built from the tenant's own
          // name (no untrusted user input is interpolated).
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}
    </>
  );
}
