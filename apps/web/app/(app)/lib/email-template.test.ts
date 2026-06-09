// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { buildTemplateInput, sampleValuesFor } from './email-template.js';

// FR-D-8 send-test core: map a stored email_template doc to the @estate/email
// render input (serialising the Lexical body to HTML), and derive sample variable
// values for a test send. Pure (serializer injected) → unit-tested; the endpoint
// glue that wires getTenantMailer + sendTemplatedEmail is verified by build/smoke.

describe('buildTemplateInput', () => {
  it('maps the subject and serialises the Lexical body to HTML', () => {
    const input = buildTemplateInput(
      { subject: 'Hi {{name}}', body: { root: {} } },
      () => '<p>x</p>',
    );
    expect(input).toEqual({ subject: 'Hi {{name}}', html: '<p>x</p>' });
  });

  it('includes the preheader when present', () => {
    const input = buildTemplateInput(
      { subject: 's', preheader: 'preview text', body: { root: {} } },
      () => 'b',
    );
    expect(input.preheader).toBe('preview text');
  });

  it('renders empty HTML when there is no body', () => {
    expect(buildTemplateInput({ subject: 's' }, () => 'X').html).toBe('');
  });
});

describe('sampleValuesFor', () => {
  it('derives bracketed sample values from the declared variables', () => {
    expect(sampleValuesFor([{ name: 'firstName' }, { name: 'agency' }])).toEqual({
      firstName: '[firstName]',
      agency: '[agency]',
    });
  });

  it('tolerates missing / malformed variable entries', () => {
    expect(sampleValuesFor(undefined)).toEqual({});
    expect(sampleValuesFor([{ description: 'no name' } as never, null as never])).toEqual({});
  });
});
