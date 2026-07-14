import type { Metadata } from 'next';

import { getRequestOrigin } from '../../lib/tenant.js';
import { SignInForm } from './SignInForm.js';

// EPIC-T FR-T-3 sign-in page (`/sign-in`). Server Component shell around the client form,
// mirroring `/register` (design brief §Authentication forms — centred single-column layout,
// max width --size-container-sm).
//
// The form and the audited `submitSignIn` action have existed since the auth slice; this
// PAGE was missing, so /sign-in returned a 500 while /register, /forgot-password and
// /reset-password all linked to it. Mounting the route is the whole fix.
//
// `?next=` carries the route a customer was bounced off (FR-T-3). It is passed through to
// the form as a hidden field and SANITISED SERVER-SIDE by the action, which reduces
// anything that is not a same-origin absolute path — including a protocol-relative `//evil`
// — to the default `/account`. The page therefore does not need to trust it, but it does
// refuse a repeated `?next=` (which arrives as an array) rather than forwarding one.

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();
  const url = `${origin}/sign-in`;
  const title = 'Sign in';
  const description = 'Sign in to your account to view saved properties, alerts and viewings.';
  return {
    title,
    description,
    alternates: { canonical: url },
    // A sign-in form has no place in search results.
    robots: { index: false, follow: true },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params['next'];
  const next = typeof raw === 'string' ? raw : undefined;

  return (
    <main id="main" className="container py-12">
      <div className="mx-auto w-full max-w-[var(--size-container-sm)]">
        <h1 className="t-display-sm">Sign in</h1>
        <p className="t-body-lg text-text-secondary mt-4">
          Welcome back. Sign in to see your saved properties, your alerts and your viewings.
        </p>
        <div className="mt-8">
          <SignInForm {...(next === undefined ? {} : { next })} />
        </div>
      </div>
    </main>
  );
}
