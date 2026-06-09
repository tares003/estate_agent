// responsive-coverage: opt-out all — asserts the thread content + visibility
// badges; layout is the admin-routes Playwright pass (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { EnquiryNote } from '../../../lib/enquiry-notes.js';
import { EnquiryNotesThread } from './EnquiryNotesThread.js';

function note(over: Partial<EnquiryNote> = {}): EnquiryNote {
  return {
    id: 'n1',
    body: 'Called the buyer.',
    isInternal: true,
    authorAgentId: null,
    createdAt: new Date('2026-06-09T11:00:00.000Z'),
    ...over,
  };
}

describe('EnquiryNotesThread', () => {
  it('renders an empty state when there are no notes', () => {
    render(<EnquiryNotesThread notes={[]} />);
    expect(screen.getByText('No notes yet.')).toBeInTheDocument();
  });

  it('renders each note body with its visibility badge', () => {
    render(
      <EnquiryNotesThread
        notes={[
          note({ id: 'a', body: 'Internal reminder', isInternal: true }),
          note({ id: 'b', body: 'Shared with client', isInternal: false }),
        ]}
      />,
    );
    expect(screen.getByText('Internal reminder')).toBeInTheDocument();
    expect(screen.getByText('Internal')).toBeInTheDocument();
    expect(screen.getByText('Shared with client')).toBeInTheDocument();
    expect(screen.getByText('Client-visible')).toBeInTheDocument();
  });
});
