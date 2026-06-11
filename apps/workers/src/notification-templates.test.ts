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
});
