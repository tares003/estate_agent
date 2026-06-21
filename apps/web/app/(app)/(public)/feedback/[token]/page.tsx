import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { feedbackLinkSecret, verifyFeedbackToken } from '../../../lib/feedback-access.js';
import { FeedbackForm } from './FeedbackForm.js';

// EPIC-AC FR-AC-2/3 — the no-sign-in feedback page a respondent opens from an
// emailed one-time link. The signed token IS the authorisation: it is verified
// before anything renders; a bad / expired / tampered link is a 404 (reveals
// nothing). The page itself reads nothing from the DB — the token carries the
// trigger context, and the submission action (actions.ts) does the write. This is
// a token page, so it is never indexed.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Share your feedback',
  robots: { index: false, follow: false },
};

export default async function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = verifyFeedbackToken(token, feedbackLinkSecret(), Date.now());
  if (context === null) {
    notFound();
  }

  return (
    <main id="main" className="container py-12">
      <div className="flex max-w-[40rem] flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="t-display-sm">Share your feedback</h1>
          <p className="t-body-lg text-text-secondary">
            Your feedback helps us improve, and it only takes a moment.
          </p>
        </header>
        <FeedbackForm token={token} />
      </div>
    </main>
  );
}
