import type { Metadata } from 'next';

import { getRequestOrigin } from '../../lib/tenant.js';
import { ResetPasswordForm } from './ResetPasswordForm.js';

// EPIC-N FR-N-5 reset-password page (`/reset-password?token=…`). Server Component
// shell that reads the opaque token from the query string (better-auth's reset link
// redirects here with `?token=<token>`) and hands it to the client form, which
// consumes it to set the new password (design brief §Login / register /
// password-reset screens — centred single-column layout, max width
// --size-container-sm).

export const dynamic = 'force-dynamic';

interface ResetPasswordPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();
  const url = `${origin}/reset-password`;
  const title = 'Choose a new password';
  const description = 'Set a new password for your account using your secure reset link.';
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: false, follow: false },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/** Read the single-valued `token` query param, or '' when absent/repeated. */
function readToken(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? '';
  return '';
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = (await searchParams) ?? {};
  const token = readToken(params['token']);

  return (
    <main id="main" className="container py-12">
      <div className="mx-auto w-full max-w-[var(--size-container-sm)]">
        <h1 className="t-display-sm">Choose a new password</h1>
        {token === '' ? (
          <p className="t-body-lg text-text-secondary mt-4">
            This reset link is missing or incomplete. Request a new one from the{' '}
            <a href="/forgot-password" className="underline">
              forgot-password
            </a>{' '}
            page.
          </p>
        ) : (
          <>
            <p className="t-body-lg text-text-secondary mt-4">
              Almost there — set a new password below and you’ll be ready to sign in.
            </p>
            <div className="mt-8">
              <ResetPasswordForm token={token} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
