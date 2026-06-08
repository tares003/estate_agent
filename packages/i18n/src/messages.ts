/**
 * @estate/i18n — translation-key registry (master spec §6).
 *
 * Every user-facing string in the platform routes through a translation key
 * rather than appearing as a raw literal at the call site. Only en-GB ships in
 * V1, so the catalogue here IS the en-GB source of truth; a future locale adds
 * a sibling catalogue keyed by the same identifiers.
 *
 * `defineMessages` is the declaration helper: it takes a record of
 * `key -> default (en-GB) string` and hands it straight back, but typed so the
 * literal keys are preserved and inferred. Callers get autocomplete over the
 * exact keys they declared, and the runtime accessor (`t`) can resolve them.
 */

/** A single message catalogue: maps each translation key to its en-GB default. */
export type MessageCatalogue = Readonly<Record<string, string>>;

/**
 * Declare a typed message catalogue.
 *
 * Identity at runtime — the value is returned unchanged — but the generic keeps
 * the literal key union, so `keyof typeof catalogue` is the exact set of keys
 * declared, not a widened `string`.
 *
 * @example
 *   const m = defineMessages({ 'common.submit': 'Submit' });
 *   m['common.submit']; // 'Submit', and the key is statically checked
 */
export function defineMessages<const TCatalogue extends MessageCatalogue>(
  catalogue: TCatalogue,
): TCatalogue {
  return catalogue;
}

/**
 * The shared en-GB catalogue. A representative handful of cross-surface keys
 * that many forms and dialogues reuse; feature packages declare their own
 * catalogues with `defineMessages` and resolve them through `createTranslator`.
 */
export const MESSAGES = defineMessages({
  'common.submit': 'Submit',
  'common.cancel': 'Cancel',
  'common.required': 'This field is required',
  'validation.email.invalid': 'Enter a valid email address',
  'validation.consent.required': 'You must agree before continuing',
});

/** The literal-key union of the shared en-GB catalogue. */
export type MessageKey = keyof typeof MESSAGES;
