// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { BLOCK_REGISTRY } from '../../../components/blocks/registry.js';
import { payloadBlockToSection, payloadPageToSections, type PayloadBlock } from './cms-mapper.js';

// EPIC-D (B23.4): the mapper turns Payload block instances ({ blockType, ...fields })
// into the PageRenderer section shape ({ type, data }). The decisive guarantee is
// that mapped data validates against the renderer's Zod schema — so live CMS
// content always renders. rich_text is special: its Lexical `content` is
// serialised to html via an injected serializer (the real one is Payload's
// convertLexicalToHTML, wired in cms.ts).

const html = () => '<p>hello</p>';

describe('payloadBlockToSection', () => {
  it('maps a direct block: drops blockType, passes fields through as data', () => {
    const section = payloadBlockToSection(
      { blockType: 'hero', id: 'abc', title: 'Welcome', eyebrow: 'Estate' },
      html,
    );
    expect(section.type).toBe('hero');
    expect(section.data).toMatchObject({ title: 'Welcome', eyebrow: 'Estate' });
    expect((section.data as Record<string, unknown>).blockType).toBeUndefined();
  });

  it('maps rich_text via the injected serializer to { html, align }', () => {
    const section = payloadBlockToSection(
      { blockType: 'rich_text', id: 'x', content: { root: {} }, align: 'center' },
      html,
    );
    expect(section.type).toBe('rich_text');
    expect(section.data).toEqual({ html: '<p>hello</p>', align: 'center' });
  });

  it('rich_text with no content serialises to empty html (never crashes)', () => {
    const section = payloadBlockToSection({ blockType: 'rich_text', content: null }, html);
    expect(section.data).toMatchObject({ html: '' });
  });

  it('strips Payload null optionals so renderer .optional() fields still validate', () => {
    // Payload returns null (not undefined) for unset optional fields; Zod
    // .optional() rejects null. The mapper must drop them or the block is skipped.
    const section = payloadBlockToSection(
      {
        blockType: 'hero',
        title: 'T',
        eyebrow: null,
        description: null,
        ctaLabel: null,
        ctaHref: null,
      },
      html,
    );
    expect(section.data).toEqual({ title: 'T' });
  });

  it('strips a null align on rich_text', () => {
    const section = payloadBlockToSection(
      { blockType: 'rich_text', content: { root: {} }, align: null },
      html,
    );
    expect(section.data).toEqual({ html: '<p>hello</p>' });
  });
});

describe('payloadPageToSections', () => {
  it('maps an ordered list of blocks, preserving order', () => {
    const sections = payloadPageToSections(
      [
        { blockType: 'hero', title: 'A' },
        { blockType: 'cta_strip', heading: 'B', ctaLabel: 'Go', ctaHref: '/x' },
      ],
      html,
    );
    expect(sections.map((s) => s.type)).toEqual(['hero', 'cta_strip']);
  });

  it('tolerates a missing/empty sections array', () => {
    expect(payloadPageToSections(null, html)).toEqual([]);
    expect(payloadPageToSections(undefined, html)).toEqual([]);
    expect(payloadPageToSections([], html)).toEqual([]);
  });
});

describe('mapped data round-trips through the renderer registry', () => {
  // Samples carry Payload's null optionals + id/blockName, exactly as the Local
  // API returns them — the round-trip must survive that, not an idealised shape.
  const samples: Record<string, PayloadBlock> = {
    hero: {
      blockType: 'hero',
      id: '1',
      blockName: null,
      title: 'Welcome',
      eyebrow: 'Estate',
      description: null,
      ctaLabel: null,
      ctaHref: null,
    },
    cta_strip: {
      blockType: 'cta_strip',
      id: '2',
      blockName: null,
      heading: 'Sell',
      description: null,
      ctaLabel: 'Start',
      ctaHref: '/v',
    },
    faq: {
      blockType: 'faq',
      id: '3',
      blockName: null,
      title: null,
      items: [{ id: 'i1', question: 'When?', answer: 'Soon.' }],
    },
    rich_text: {
      blockType: 'rich_text',
      id: '4',
      blockName: null,
      content: { root: {} },
      align: null,
    },
  };

  for (const [type, block] of Object.entries(samples)) {
    it(`${type}: mapper output validates against BLOCK_REGISTRY['${type}'].schema`, () => {
      const section = payloadBlockToSection(block, html);
      const registered = BLOCK_REGISTRY[type];
      expect(registered).toBeDefined();
      const result = registered!.schema.safeParse(section.data);
      expect(result.success).toBe(true);
    });
  }
});
