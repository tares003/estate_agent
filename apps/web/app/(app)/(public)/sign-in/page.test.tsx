// responsive-coverage: opt-out all — asserts the page shell + the ?next= passthrough;
// layout is the auth-forms Playwright pass (design brief §Authentication forms).
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// EPIC-T FR-T-3 — the sign-in page (`/sign-in`).
//
// The form and its audited action have existed (and been tested) since the auth slice;
// the PAGE was never mounted, so /sign-in 500'd — while /register, /forgot-password and
// /reset-password each link to it ("Back to sign in"). Every one of those links was dead.
// These tests pin the shell, and the ?next= passthrough that makes FR-T-3 work.

vi.mock('../../lib/tenant.js', () => ({
  getRequestOrigin: async () => 'https://acme.example.com',
}));

vi.mock('./SignInForm.js', () => ({
  SignInForm: ({ next }: { next?: string }) => (
    <div data-testid="sign-in-form" data-next={next ?? ''} />
  ),
}));

const { default: SignInPage, generateMetadata } = await import('./page.js');

describe('SignInPage', () => {
  it('renders the heading and the sign-in form', async () => {
    render(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByTestId('sign-in-form')).toBeInTheDocument();
  });

  it('carries a ?next= destination through to the form (FR-T-3)', async () => {
    // A customer bounced here from a gated route must land back on it after signing in.
    render(await SignInPage({ searchParams: Promise.resolve({ next: '/account/saved' }) }));

    expect(screen.getByTestId('sign-in-form')).toHaveAttribute('data-next', '/account/saved');
  });

  it('ignores a repeated ?next= (an array), rather than passing an array through', async () => {
    render(
      await SignInPage({
        searchParams: Promise.resolve({ next: ['/account', '/evil'] }),
      }),
    );

    // Not a single string → no destination; the action falls back to /account.
    expect(screen.getByTestId('sign-in-form')).toHaveAttribute('data-next', '');
  });

  it('is not indexed — a sign-in page has no place in search results', async () => {
    const meta = await generateMetadata();
    expect(meta.robots).toMatchObject({ index: false });
    expect(meta.alternates?.canonical).toBe('https://acme.example.com/sign-in');
  });
});
