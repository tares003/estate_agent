import { z } from 'zod';

// EPIC-O FR-O-11 — the managed URL redirect-rule schema. Staff add 301/302 (and the
// model's 307/410) rules mapping an old path to a new one; the proxy consults them at
// request time so an old path redirects to its canonical replacement. The schema is
// the single gate between the admin redirect-rules editor and persistence. Pure
// configuration — captures NO personal data, so it carries no GDPR-consent
// affirmation, and (an authenticated admin action) no Turnstile.
//
// `type` mirrors the Prisma `RedirectType` enum (the schema is the source of truth,
// G6): `r301` permanent, `r302` found, `r307` temporary, `gone` (410, serves no
// destination). `sourcePath` must be a root-relative path (starts with `/`).

/** The redirect statuses, mirroring the Prisma `RedirectType` enum. */
export const REDIRECT_TYPES = ['r301', 'r302', 'r307', 'gone'] as const;

/** A single redirect status. */
export type RedirectType = (typeof REDIRECT_TYPES)[number];

/** Maximum length of either path (keeps the table legible + bounds storage). */
export const REDIRECT_PATH_MAX = 2048;

/** A root-relative path: must start with `/` (no scheme/host — same-origin only). */
const sourcePath = z
  .string()
  .trim()
  .min(1, 'Enter the path to redirect from.')
  .max(REDIRECT_PATH_MAX)
  .startsWith('/', 'The from-path must start with “/”.');

/** The destination a request is sent to. A root-relative path or an absolute URL. */
const destinationPath = z
  .string()
  .trim()
  .min(1, 'Enter where the path should redirect to.')
  .max(REDIRECT_PATH_MAX);

/** Create a new redirect rule (the add-rule form). */
export const redirectCreateSchema = z.object({
  sourcePath,
  destinationPath,
  type: z.enum(REDIRECT_TYPES),
});

/** Edit an existing redirect rule (carries the id of the rule being changed). */
export const redirectUpdateSchema = z.object({
  id: z.string().uuid(),
  sourcePath,
  destinationPath,
  type: z.enum(REDIRECT_TYPES),
});

/** A validated new-redirect input. */
export type RedirectCreate = z.infer<typeof redirectCreateSchema>;

/** A validated redirect-edit input. */
export type RedirectUpdate = z.infer<typeof redirectUpdateSchema>;
