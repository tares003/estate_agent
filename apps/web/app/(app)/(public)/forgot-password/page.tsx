import type { Metadata } from 'next';

import { getRequestOrigin } from '../../lib/tenant.js';
import { ForgotPasswordForm } from './ForgotPasswordForm.js';

// EPIC-N FR-N-5 forgot-password page (`/forgot-password`). Server Component shell
// around the client form; the submission asks better-auth to email an opaque,
// single-use reset link (design brief §Login / register / password-reset screens —
// centred single-column layout, max width --size-container-sm).

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();
  const url = `${origin}/forgot-password`;
  const title = 'Reset your password';
  const description = 'Request a secure link to choose a new password for your account.';
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: false, follow: false },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default function ForgotPasswordPage() {
  return (
    <main id="main" className="container py-12">
      <div className="mx-auto w-full max-w-[var(--size-container-sm)]">
        <h1 className="t-display-sm">Forgot your password?</h1>
        <p className="t-body-lg text-text-secondary mt-4">
          It happens. Enter your email and we’ll send you a secure link to set a new one.
        </p>
        <div className="mt-8">
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}
