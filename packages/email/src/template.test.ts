import { describe, expect, it, vi } from 'vitest';

import { renderTemplate, sendTemplatedEmail } from './template.js';
import type { Mailer } from './mailer.js';

// EPIC-D FR-D-8: CMS-managed email templates. renderTemplate is the pure
// interpolation engine that turns a stored template (subject + preheader + body
// HTML) + variable values into a ready-to-send subject + HTML. Values are
// HTML-escaped where they land in markup (the body/preheader) to prevent
// injection/breakage; the subject is a plain-text header so it is not escaped.

describe('renderTemplate', () => {
  it('interpolates {{var}} (with or without surrounding spaces) in subject and body', () => {
    const out = renderTemplate(
      { subject: 'Welcome, {{firstName}}', html: '<p>Hi {{ firstName }} at {{agency}}</p>' },
      { firstName: 'Sam', agency: 'Acme' },
    );
    expect(out.subject).toBe('Welcome, Sam');
    expect(out.html).toContain('Hi Sam at Acme');
  });

  it('replaces every occurrence of a variable', () => {
    const out = renderTemplate({ subject: 's', html: '{{x}}-{{x}}-{{x}}' }, { x: 'a' });
    expect(out.html).toContain('a-a-a');
  });

  it('renders a missing variable as an empty string', () => {
    const out = renderTemplate({ subject: 'Hi {{name}}', html: '<p>{{name}}</p>' }, {});
    expect(out.subject).toBe('Hi ');
    expect(out.html).toContain('<p></p>');
  });

  it('HTML-escapes interpolated values in the body (no injection)', () => {
    const out = renderTemplate(
      { subject: 's', html: '<p>{{bio}}</p>' },
      { bio: '<script>x</script>&"' },
    );
    expect(out.html).not.toContain('<script>');
    expect(out.html).toContain('&lt;script&gt;');
    expect(out.html).toContain('&amp;');
    expect(out.html).toContain('&quot;');
  });

  it('does NOT escape the subject (it is a plain-text header)', () => {
    const out = renderTemplate({ subject: 'Re: {{x}}', html: 'b' }, { x: 'A & B <ok>' });
    expect(out.subject).toBe('Re: A & B <ok>');
  });

  it('coerces non-string values and treats null/undefined as empty', () => {
    const out = renderTemplate(
      { subject: 'n={{n}}', html: '<p>{{n}} {{missing}}</p>' },
      { n: 42, missing: null },
    );
    expect(out.subject).toBe('n=42');
    expect(out.html).toContain('<p>42 </p>');
  });

  it('injects the preheader as a hidden element at the top of the body', () => {
    const out = renderTemplate(
      { subject: 's', preheader: 'Your {{thing}} is ready', html: '<p>Body</p>' },
      { thing: 'report' },
    );
    expect(out.html).toMatch(/Your report is ready/);
    // hidden from the visible body (standard inbox-preview technique)
    expect(out.html).toMatch(/display\s*:\s*none/i);
    // and it precedes the body
    expect(out.html.indexOf('Your report is ready')).toBeLessThan(out.html.indexOf('Body'));
  });
});

describe('sendTemplatedEmail', () => {
  it('renders then sends via the injected mailer', async () => {
    const send = vi.fn().mockResolvedValue({ messageId: 'abc' });
    const mailer: Mailer = { send };
    const result = await sendTemplatedEmail(
      mailer,
      { subject: 'Hi {{name}}', html: '<p>{{name}}</p>' },
      { name: 'Sam' },
      'sam@acme.test',
    );
    expect(result.messageId).toBe('abc');
    expect(send).toHaveBeenCalledWith({
      to: 'sam@acme.test',
      subject: 'Hi Sam',
      html: '<p>Sam</p>',
    });
  });
});
