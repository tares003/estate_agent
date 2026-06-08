/**
 * @estate/entitlement — per-tenant feature-pack entitlement (EPIC-AD).
 *
 * Every pack-dependent code path consults this package (CI guard G12). The
 * public API: the pack catalogue, the entitlement source interface + in-memory
 * factory, the `isPackEnabled` check, the throwing `requirePack` guard, and the
 * `<RequirePack>` Server Component.
 */

export {
  ALL_PACK_SLUGS,
  OPTIONAL_PACK_SLUGS,
  type OptionalPackSlug,
  type PackSlug,
} from './packs.js';
export { createInMemoryPackSource, type EnabledPacksByTenant, type PackSource } from './source.js';
export { isPackEnabled } from './isPackEnabled.js';
export { PackNotEnabledError, requirePack } from './requirePack.js';
export { RequirePack, type RequirePackProps } from './RequirePack.jsx';
