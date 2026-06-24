import type { Metadata } from 'next';

import { getRequestOrigin } from '../../lib/tenant.js';
import { RegisterForm } from './RegisterForm.js';

// EPIC-T FR-T-1 register page (`/register`). Server Component shell around the
// client form; the submission creates a `type=customer` account and sends an
// email-verification link (design brief §Authentication forms — centred
// single-column layout, max width --size-container-sm).

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();
  const url = `${origin}/register`;
  const title = 'Create an account';
  const description = 'Register to save properties, set up alerts and track your viewings.';
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: false, follow: true },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default function RegisterPage() {
  return (
    <main id="main" className="container py-12">
      <div className="mx-auto w-full max-w-[var(--size-container-sm)]">
        <h1 className="t-display-sm">Create an account</h1>
        <p className="t-body-lg text-text-secondary mt-4">
          Save properties, get alerts for new matches, and keep track of your viewings — all in one
          place.
        </p>
        <div className="mt-8">
          <RegisterForm />
        </div>
      </div>
    </main>
  );
}
