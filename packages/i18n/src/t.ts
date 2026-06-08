/**
 * @estate/i18n — runtime translation accessor.
 *
 * `t(key, args?)` resolves a key to its en-GB string from the shared `MESSAGES`
 * catalogue and interpolates any `{placeholder}` tokens from `args`.
 *
 * Deterministic fallbacks (no throwing, no randomness — every input maps to one
 * stable output):
 *   - Unknown key            -> the key string itself is returned verbatim.
 *   - Missing arg placeholder -> the `{token}` is left in place untouched.
 *
 * Feature packages declare their own catalogues with `defineMessages` and build
 * a scoped accessor with `createTranslator(catalogue)`; `t` is that accessor
 * bound to the shared catalogue.
 */

import { MESSAGES, type MessageCatalogue, type MessageKey } from './messages.js';

/** Interpolation arguments: each `{name}` token is replaced by `args[name]`. */
export type TranslateArgs = Readonly<Record<string, string | number>>;

/** Matches a `{placeholder}` token: a brace-wrapped identifier. */
const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Interpolate `{token}` placeholders in `template` from `args`. A token whose
 * key is absent from `args` is left in place verbatim (deterministic), so the
 * gap is visible rather than silently blanked.
 */
function interpolate(template: string, args: TranslateArgs | undefined): string {
  if (!args) return template;
  return template.replace(PLACEHOLDER, (token, name: string) =>
    Object.prototype.hasOwnProperty.call(args, name) ? String(args[name]) : token,
  );
}

/**
 * Build a translator bound to a specific catalogue. The returned function
 * resolves a declared key to its (interpolated) string and falls back to the
 * raw key for anything not in the catalogue.
 */
export function createTranslator<TCatalogue extends MessageCatalogue>(
  catalogue: TCatalogue,
): (key: keyof TCatalogue, args?: TranslateArgs) => string {
  return (key, args) => {
    const template = catalogue[key as keyof TCatalogue & string];
    if (template === undefined) return String(key);
    return interpolate(template, args);
  };
}

/** Translator bound to the shared en-GB `MESSAGES` catalogue. */
const translateShared = createTranslator(MESSAGES);

/**
 * Resolve a shared-catalogue key to its en-GB string, interpolating `args`.
 *
 * @example t('common.submit')                    // 'Submit'
 * @example t('greeting.hello', { name: 'Olive' }) // 'Hello Olive' (custom cat.)
 */
export function t(key: MessageKey, args?: TranslateArgs): string {
  return translateShared(key, args);
}
