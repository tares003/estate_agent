// The @estate ESLint plugin — aggregates the six AST-level CI guard rules so a
// flat config can register them under the `estate/` namespace:
//   estate/audit-log-coverage  (G4)
//   estate/gdpr-consent        (G5)
//   estate/naming              (G6)
//   estate/design-token        (G7)
//   estate/trust-marker        (G8)
//   estate/pack-entitlement    (G12)
//
// The other guards (G1, G2, G3, G9, G10, G11) reason about the PR diff, the
// coverage report, bundle sizes, axe results or test-file viewport coverage —
// they are not per-AST concerns and live as standalone modules under guards/.
import auditLogCoverage from './rules/g04-audit-log-coverage.js';
import gdprConsent from './rules/g05-gdpr-consent.js';
import naming from './rules/g06-naming.js';
import designToken from './rules/g07-design-token.js';
import trustMarker from './rules/g08-trust-marker.js';
import packEntitlement from './rules/g12-pack-entitlement.js';

export const rules = {
  'audit-log-coverage': auditLogCoverage,
  'gdpr-consent': gdprConsent,
  naming,
  'design-token': designToken,
  'trust-marker': trustMarker,
  'pack-entitlement': packEntitlement,
};

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: { name: '@estate/guards', version: '0.0.0' },
  rules,
};

export default plugin;
