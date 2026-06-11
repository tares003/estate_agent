// EPIC-G ticket reference (master spec §G.1/§G.6, FR-G-3) — the human-readable
// ticket number shown on the success page and in the confirmation email
// (e.g. "RPR-2026-04321"). Pure formatting; the sequence number comes from the
// caller (the intake action derives it per-tenant inside the submission
// transaction, with the per-tenant unique constraint as the concurrency backstop).

/** Format the §G.1 ticket number for a submission date + per-tenant sequence. */
export function repairReference(submittedAt: Date, sequence: number): string {
  const year = submittedAt.getUTCFullYear();
  return `RPR-${year}-${String(sequence).padStart(5, '0')}`;
}
