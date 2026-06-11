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
  });

  it('returns null for an event with no template', () => {
    expect(renderNotification('mystery.event', {})).toBeNull();
  });
});
