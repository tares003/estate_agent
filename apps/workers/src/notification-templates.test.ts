import { describe, expect, it } from 'vitest';

import { renderNotification } from './notification-templates.js';

describe('renderNotification', () => {
  it('renders the FR-G-3 repair confirmation with the ticket reference', () => {
    const message = renderNotification('repair_request.received', {
      reference: 'RPR-2026-00042',
      name: 'Tess Tenant',
      category: 'Plumbing',
      urgency: 'urgent',
    });

    expect(message).not.toBeNull();
    expect(message!.subject).toContain('RPR-2026-00042');
    expect(message!.html).toContain('Tess Tenant');
    expect(message!.html).toContain('RPR-2026-00042');
    expect(message!.html).toContain('Plumbing');
  });

  it('HTML-escapes payload values that land in markup', () => {
    const message = renderNotification('repair_request.received', {
      reference: 'RPR-2026-00001',
      name: '<script>alert(1)</script>',
      category: 'Doors & locks',
      urgency: 'standard',
    });

    expect(message!.html).not.toContain('<script>');
    expect(message!.html).toContain('&lt;script&gt;');
    expect(message!.html).toContain('Doors &amp; locks');
  });

  it('tolerates a missing or malformed payload (renders with blanks)', () => {
    const message = renderNotification('repair_request.received', null);
    expect(message).not.toBeNull();
    expect(message!.subject).toContain('repair');
    // a non-object payload is equally tolerated
    expect(renderNotification('repair_request.received', 'garbage')).not.toBeNull();
  });

  it('interpolates number and boolean payload values and drops non-scalar ones', () => {
    const message = renderNotification('repair_request.received', {
      reference: 42,
      name: true,
      category: { nested: 'object' },
      urgency: ['array'],
    });
    expect(message!.subject).toContain('42');
    expect(message!.html).toContain('true');
    expect(message!.html).not.toContain('nested');
    expect(message!.html).not.toContain('array');
  });

  it('returns null for an event with no template', () => {
    expect(renderNotification('mystery.event', {})).toBeNull();
  });

  it('renders the EPIC-N magic-link sign-in email with the link url', () => {
    const message = renderNotification('auth.magic_link', {
      url: 'https://acme.test/api/auth/magic-link/verify?token=abc.def',
    });
    expect(message).not.toBeNull();
    expect(message!.subject.toLowerCase()).toContain('sign in');
    expect(message!.html).toContain('https://acme.test/api/auth/magic-link/verify?token=abc.def');
  });

  it('renders the FR-G-8 contractor-assignment email with the magic-link', () => {
    const message = renderNotification('repair.contractor_assigned', {
      reference: 'RPR-2026-00042',
      contractorName: 'Ace Plumbing',
      link: 'https://acme.test/repairs/contractor/tok.en.sig',
    });
    expect(message).not.toBeNull();
    expect(message!.subject).toContain('RPR-2026-00042');
    expect(message!.html).toContain('Ace Plumbing');
    expect(message!.html).toContain('https://acme.test/repairs/contractor/tok.en.sig');
  });

  it('renders the EPIC-N FR-N-5 password-reset email with the reset url', () => {
    const message = renderNotification('auth.password_reset', {
      url: 'https://acme.test/reset-password?token=aZ09aZ09aZ09aZ09aZ09aZ09',
    });
    expect(message).not.toBeNull();
    expect(message!.subject.toLowerCase()).toMatch(/reset|password/);
    expect(message!.html).toContain(
      'https://acme.test/reset-password?token=aZ09aZ09aZ09aZ09aZ09aZ09',
    );
  });

  it('renders the FR-AC-1/12 post-repair feedback request with the feedback url', () => {
    const message = renderNotification('feedback.requested', {
      url: 'https://acme.test/feedback/seg.123.sig',
    });
    expect(message).not.toBeNull();
    expect(message!.subject.toLowerCase()).toMatch(/feedback|how did we do|rate/);
    expect(message!.html).toContain('https://acme.test/feedback/seg.123.sig');
  });

  it('renders the EPIC-T FR-T-7/8 saved-search digest with the search name and each match', () => {
    const message = renderNotification('saved_search.digest', {
      searchName: 'Didsbury 2-beds',
      baseUrl: 'https://acme.test',
      properties: [
        {
          title: 'A lovely flat',
          address: '1 High Street, M20 2AB',
          price: '£250,000',
          href: '/properties/a-flat',
        },
        {
          title: 'A semi',
          address: '2 Low Road, M20 3CD',
          price: 'POA',
          href: '/properties/a-semi',
        },
      ],
    });
    expect(message).not.toBeNull();
    expect(message!.subject).toContain('Didsbury 2-beds');
    expect(message!.subject).toMatch(/2/); // the count of new matches
    expect(message!.html).toContain('A lovely flat');
    expect(message!.html).toContain('1 High Street, M20 2AB');
    expect(message!.html).toContain('£250,000');
    expect(message!.html).toContain('https://acme.test/properties/a-flat');
    expect(message!.html).toContain('A semi');
    expect(message!.html).toContain('POA');
  });

  it('HTML-escapes saved-search digest property fields that land in markup', () => {
    const message = renderNotification('saved_search.digest', {
      searchName: '<b>x</b>',
      baseUrl: 'https://acme.test',
      properties: [
        {
          title: '<script>alert(1)</script>',
          address: 'Doors & locks',
          price: '£1',
          href: '/properties/x',
        },
      ],
    });
    expect(message!.html).not.toContain('<script>');
    expect(message!.html).toContain('&lt;script&gt;');
    expect(message!.html).toContain('Doors &amp; locks');
  });

  it('falls back to a relative href when no baseUrl is supplied for the digest', () => {
    const message = renderNotification('saved_search.digest', {
      searchName: 'Any',
      properties: [{ title: 'T', address: 'A', price: '£1', href: '/properties/t' }],
    });
    expect(message!.html).toContain('/properties/t');
  });

  it('returns null for a saved-search digest with no matches (the worker never queues one)', () => {
    expect(
      renderNotification('saved_search.digest', {
        searchName: 'Empty',
        properties: [],
      }),
    ).toBeNull();
  });

  it('uses the singular noun and a fallback heading for a one-match, unnamed digest', () => {
    const message = renderNotification('saved_search.digest', {
      properties: [{ title: 'T', address: 'A', price: '£1', href: '/properties/t' }],
    });
    expect(message).not.toBeNull();
    expect(message!.subject).toContain('1 new property');
    expect(message!.html).toContain('your saved search');
  });

  it('returns null for a malformed saved-search digest payload (no usable properties)', () => {
    expect(renderNotification('saved_search.digest', null)).toBeNull();
    expect(renderNotification('saved_search.digest', 'garbage')).toBeNull();
    expect(renderNotification('saved_search.digest', { properties: 'nope' })).toBeNull();
    expect(renderNotification('saved_search.digest', { properties: [null, 7] })).toBeNull();
  });
});
