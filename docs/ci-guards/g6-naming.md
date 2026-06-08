# G6 — Canonical naming (forbidden nouns)

**Catches:** forbidden estate-agency jargon used as a code identifier where a canonical `PRODUCT.md` §2 noun is required.

**Enforced by:** the ESLint rule `estate/naming` (`packages/config/plugin/rules/g06-naming.js`, messageId `forbiddenNoun`).

**Trigger:** a declared identifier (function / class / interface / type / enum / variable / property name) whose camelCase/PascalCase/snake_case segments include an unambiguous forbidden noun:

| Forbidden                   | Use instead            |
| --------------------------- | ---------------------- |
| `lead`, `leads`             | `enquiry`, `enquiries` |
| `inquiry`, `inquiries` (US) | `enquiry`, `enquiries` |
| `renter(s)`                 | `tenant(s)`            |
| `realtor(s)`                | `agent(s)`             |

Forbidden nouns remain legal in **UI-label string / JSX-text** contexts (the admin label `"Lead"`); the rule inspects identifiers only, never string literals.

**Scope note — false-positive avoidance:** the ambiguous entity-name cases (`house`/`listing` as the catalogue entity, `client`/`customer` as a person) are **not** blanket-matched, because innocent identifiers collide (`prismaClient`, `warehouse`, `customerAccount`, the canonical registered-`Customer`). The catalogue entity is enforced structurally instead — code must use the `Property` type from `@estate/types`, so naming it `Listing` fails the type-check.

**Canonical violation → fix:** `function createLead()` / `interface LeadInput` / `model Lead` fail; `createEnquiry` / `EnquiryInput` / `model Enquiry` pass.
