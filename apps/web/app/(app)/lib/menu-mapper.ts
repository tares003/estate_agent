import { z } from 'zod';

// EPIC-D FR-D-7 (B24): pure mapper from a Payload `menus` doc to a plain,
// renderer-ready nav tree. NO Payload imports (mirrors cms-mapper.ts) so it stays
// node-env unit-testable; the heavy Local-API wiring lives in cms.ts. navItemSchema
// is the single source of truth the SiteNav consumes — nesting is capped at two
// levels (a child is a leaf, no grandchildren).

const navLeafSchema = z.object({
  label: z.string(),
  href: z.string(),
  target: z.enum(['same', 'new']),
  icon: z.string().optional(),
  roles: z.array(z.string()).optional(),
});

/** A renderable nav item: a leaf plus an optional one level of leaf children. */
export const navItemSchema = navLeafSchema.extend({
  children: z.array(navLeafSchema).optional(),
});

export type NavItem = z.infer<typeof navItemSchema>;
export type MenuLocation = 'header' | 'footer' | 'mobile';
export interface RenderableMenu {
  location: MenuLocation;
  items: NavItem[];
}

/** A raw Payload menu-item row (array field), pre-mapping. */
export interface PayloadMenuItem {
  label?: unknown;
  url?: unknown;
  target?: unknown;
  icon?: unknown;
  roles?: unknown;
  visibility?: unknown;
  children?: unknown;
  [key: string]: unknown;
}

/** A raw Payload `menus` document, pre-mapping. */
export interface PayloadMenuDoc {
  location?: unknown;
  items?: unknown;
  [key: string]: unknown;
}

/**
 * Map one item to a nav LEAF (no children) — fail-soft + normalised + type-safe.
 * Builds the object field-by-field with validated/coerced values (no unchecked
 * cast): label/url must be non-empty strings, icon must be a string, roles is
 * coerced to a string[] (non-string elements dropped), target normalises to
 * 'same'/'new'. Empty-optionals are simply not added, so the result satisfies
 * navItemSchema by construction.
 */
function toNavLeaf(item: PayloadMenuItem | null | undefined): NavItem | null {
  if (item == null || typeof item !== 'object') {
    return null;
  }
  if (item.visibility === false) {
    return null; // hidden item
  }
  const { label, url, target, icon, roles } = item;
  if (typeof label !== 'string' || label.length === 0) {
    return null; // no label -> would render a nameless link
  }
  if (typeof url !== 'string' || url.length === 0) {
    return null; // no destination -> would render a broken link
  }
  const leaf: NavItem = { label, href: url, target: target === 'new' ? 'new' : 'same' };
  if (typeof icon === 'string') {
    leaf.icon = icon;
  }
  if (Array.isArray(roles)) {
    leaf.roles = roles.filter((role): role is string => typeof role === 'string');
  }
  return leaf;
}

/** Map one Payload menu item to a nav item, recursing children ONE level. */
export function payloadMenuItemToNav(item: PayloadMenuItem | null | undefined): NavItem | null {
  const leaf = toNavLeaf(item);
  if (!leaf || item == null) {
    return null;
  }
  const children = Array.isArray(item.children)
    ? item.children
        .map((child) => toNavLeaf(child as PayloadMenuItem))
        .filter((child): child is NavItem => child !== null)
    : [];
  return children.length > 0 ? { ...leaf, children } : leaf;
}

/**
 * Filter a nav tree for an ANONYMOUS public viewer: keep items with no role gate
 * (empty/absent `roles`) and drop role-gated (staff-only) items, at both levels.
 * The pure mapper passes `roles` through; this is where the public boundary
 * applies them (the viewer context lives at the render layer, not the mapper).
 */
export function filterPublicNav(items: NavItem[]): NavItem[] {
  const isPublic = (item: NavItem): boolean => !item.roles || item.roles.length === 0;
  return items
    .filter(isPublic)
    .map((item) => (item.children ? { ...item, children: item.children.filter(isPublic) } : item));
}

/** Map a Payload menu doc to a renderable menu (order preserved, invalid items dropped). */
export function payloadMenuToNav(doc: PayloadMenuDoc | null | undefined): RenderableMenu | null {
  if (doc == null) {
    return null;
  }
  const location = (typeof doc.location === 'string' ? doc.location : 'header') as MenuLocation;
  const items = Array.isArray(doc.items)
    ? doc.items
        .map((item) => payloadMenuItemToNav(item as PayloadMenuItem))
        .filter((item): item is NavItem => item !== null)
    : [];
  return { location, items };
}
