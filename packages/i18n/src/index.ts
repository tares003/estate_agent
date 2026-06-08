/**
 * @estate/i18n — public entry point.
 *
 * Master spec §6: every user-facing string routes through a translation key;
 * only en-GB ships in V1. This package owns the key registry (`defineMessages`,
 * `MESSAGES`) and the runtime accessor (`t`, `createTranslator`).
 */

export { defineMessages, MESSAGES } from './messages.js';
export type { MessageCatalogue, MessageKey } from './messages.js';
export { createTranslator, t } from './t.js';
export type { TranslateArgs } from './t.js';
