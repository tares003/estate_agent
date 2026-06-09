import config from '@payload-config';
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html';
import { getPayload } from 'payload';

import type { PageSection } from '../../../components/blocks/PageRenderer.js';
import { payloadPageToSections, type PayloadBlock, type RichTextSerializer } from './cms-mapper.js';
import {
  payloadMenuToNav,
  type MenuLocation,
  type PayloadMenuDoc,
  type RenderableMenu,
} from './menu-mapper.js';

// Live CMS data layer (EPIC-D B23.4). Reads published pages for the current
// tenant from Payload via the Local API and maps them to the PageRenderer
// section shape. Tenant isolation is applied with an explicit tenant filter
// (Payload's Local API runs privileged), and drafts are excluded (FR-D-4). This
// module constructs the Payload instance + the Lexical→HTML serializer, so —
// like app/lib/db.ts — it is exercised via runtime smoke / e2e, not unit tests.

type LexicalData = Parameters<typeof convertLexicalToHTML>[0]['data'];

const serializeRichText: RichTextSerializer = (content) =>
  convertLexicalToHTML({ data: content as LexicalData });

/** A published page reduced to what the renderer needs. */
export interface RenderablePage {
  title: string;
  slug: string;
  sections: PageSection[];
}

/**
 * Fetch a published page by slug for the given tenant, or null if none.
 * Filters by tenant (isolation) and `_status: published` (drafts never leak to
 * the public site).
 */
export async function getPublishedPage(
  slug: string,
  tenantId: string,
): Promise<RenderablePage | null> {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: 'pages',
    where: {
      and: [
        { slug: { equals: slug } },
        { tenant: { equals: tenantId } },
        { _status: { equals: 'published' } },
      ],
    },
    limit: 1,
    depth: 1,
    pagination: false,
  });

  const doc = result.docs[0];
  if (!doc) {
    return null;
  }

  return {
    title: String(doc.title ?? ''),
    slug: String(doc.slug ?? ''),
    sections: payloadPageToSections(
      doc.sections as PayloadBlock[] | null | undefined,
      serializeRichText,
    ),
  };
}

/**
 * Fetch the CMS-managed navigation menu for a location + tenant (FR-D-7), or null
 * if none. The Local API runs PRIVILEGED, so the tenant guard MUST be an explicit
 * where clause (same as getPublishedPage). Menus are unversioned — no _status
 * filter. Read fresh per request so saves reflect within the 60s SLA; any future
 * cache wrapper must keep revalidate <= 60s.
 */
export async function getMenu(
  location: MenuLocation,
  tenantId: string,
): Promise<RenderableMenu | null> {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: 'menus',
    where: {
      and: [{ location: { equals: location } }, { tenant: { equals: tenantId } }],
    },
    limit: 1,
    depth: 1,
    pagination: false,
  });

  const doc = result.docs[0];
  if (!doc) {
    return null;
  }
  return payloadMenuToNav(doc as unknown as PayloadMenuDoc);
}
