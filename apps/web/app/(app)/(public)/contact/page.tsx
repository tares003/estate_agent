import type { Metadata } from 'next';

import { getRequestOrigin } from '../../lib/tenant.js';
import { ContactForm } from './ContactForm.js';

// EPIC-C contact page (PRODUCT.md §4 — "Contact us"). The site nav links here.
// Server Component shell around the client form; the submission produces a
// general-contact-channel enquiry (FR-I-1).

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();
  const url = `${origin}/contact`;
  const title = 'Contact us';
  const description = 'Get in touch with our team — we’ll reply as soon as we can.';
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default function ContactPage() {
  return (
    <main id="main" className="container py-12">
      <h1 className="t-display-sm">Contact us</h1>
      <p className="t-body-lg text-text-secondary mt-4 max-w-[55ch]">
        Have a question or want to talk to the team? Send us a message and we&rsquo;ll be in touch.
      </p>
      <div className="mt-8 max-w-[40rem]">
        <ContactForm />
      </div>
    </main>
  );
}
