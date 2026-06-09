import { Badge } from '@estate/ui';

import type { EnquiryNote } from '../../../lib/enquiry-notes.js';

// EPIC-H enquiry detail (FR-H-3) — the note thread. Presentational + token-driven
// (G7). Each note shows its visibility (internal vs client-visible) and when it was
// added; newest-first order comes from the read model. Fixed-locale date format so
// the output is deterministic across runtimes / tests.

const NOTE_DATE = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function EnquiryNotesThread({ notes }: { notes: EnquiryNote[] }) {
  if (notes.length === 0) {
    return <p className="t-body-sm text-text-secondary">No notes yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-4">
      {notes.map((note) => (
        <li
          key={note.id}
          className="border-divider bg-surface-raised flex flex-col gap-2 rounded-lg border p-4"
        >
          <div className="flex items-center gap-2">
            <Badge tone={note.isInternal ? 'neutral' : 'info'}>
              {note.isInternal ? 'Internal' : 'Client-visible'}
            </Badge>
            <span className="t-body-sm text-text-secondary">
              {NOTE_DATE.format(note.createdAt)}
            </span>
          </div>
          <p className="t-body-md whitespace-pre-wrap">{note.body}</p>
        </li>
      ))}
    </ul>
  );
}
