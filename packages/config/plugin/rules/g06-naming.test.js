import { it } from 'vitest';
import { makeRuleTester } from './_rule-tester.js';
import rule from './g06-naming.js';

// G6 — Naming guard. Code identifiers must use the canonical PRODUCT.md §2
// nouns, never the §3 forbidden alternatives. Forbidden nouns are allowed only
// in user-facing string/JSX-label contexts (Lead, Listing as display labels).
it('G6 naming: flags forbidden nouns in identifiers, allows canonical + UI labels', () => {
  makeRuleTester().run('@estate/naming', rule, {
    valid: [
      // canonical replacements
      { code: 'export async function createEnquiry(input) { return input; }' },
      { code: 'interface EnquiryInput { email: string; }' },
      { code: 'const property = { id: 1 };' },
      { code: 'class EstateAgent {}' },
      { code: 'const tenant = { id: 1 };' }, // rental tenant is canonical
      // forbidden noun allowed as a UI-label string literal
      { code: 'const label = "Lead";' },
      { code: 'const heading = "New listing";' },
      // forbidden noun allowed as JSX text (display label)
      { code: 'const x = <span>Lead</span>;' },
      // substrings that merely contain a forbidden noun fragment must NOT trip
      { code: 'const leaderboard = [];' },
      { code: 'function downloadReport() {}' },
      { code: 'const misleadingFlag = false;' },
    ],
    invalid: [
      // 'lead' in code → use 'enquiry'
      {
        code: 'export async function createLead(input) { return input; }',
        errors: [{ messageId: 'forbiddenNoun' }],
      },
      { code: 'interface LeadInput { email: string; }', errors: [{ messageId: 'forbiddenNoun' }] },
      { code: 'const lead = {};', errors: [{ messageId: 'forbiddenNoun' }] },
      // US spelling 'inquiry'
      { code: 'type InquiryForm = { name: string };', errors: [{ messageId: 'forbiddenNoun' }] },
      // 'renter' → use 'tenant'
      { code: 'const renter = { id: 1 };', errors: [{ messageId: 'forbiddenNoun' }] },
      // 'realtor' → use 'agent'
      { code: 'class Realtor {}', errors: [{ messageId: 'forbiddenNoun' }] },
      // snake_case forbidden segment
      { code: 'const create_lead = () => {};', errors: [{ messageId: 'forbiddenNoun' }] },
    ],
  });
});
