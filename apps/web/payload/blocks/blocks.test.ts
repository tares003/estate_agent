// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Block, Field } from 'payload';
import type { ZodTypeAny } from 'zod';

import { ctaStripBlockSchema } from '../../components/blocks/CtaStripBlock.js';
import { faqBlockSchema } from '../../components/blocks/FaqBlock.js';
import { heroBlockSchema } from '../../components/blocks/HeroBlock.js';
import { BLOCK_REGISTRY } from '../../components/blocks/registry.js';
import { Pages } from '../collections/Pages.js';
import { ctaStripBlock } from './ctaStrip.js';
import { faqBlock } from './faq.js';
import { heroBlock } from './hero.js';
import { pageBlocks } from './index.js';
import { richTextBlock } from './richText.js';

// EPIC-D parity contract (FR-D-1/2): the Payload Blocks (CMS authoring schema)
// must mirror the renderer Zod schemas one-for-one, so stored block data always
// validates against the schema the renderer consumes. These tests fail the build
// the moment the CMS schema and the renderer drift in either direction.

function namedFields(fields: Field[]): { name: string; required: boolean }[] {
  return fields.flatMap((field) =>
    'name' in field && typeof field.name === 'string'
      ? [{ name: field.name, required: 'required' in field ? Boolean(field.required) : false }]
      : [],
  );
}

const DIRECT: { block: Block; schema: { shape: Record<string, ZodTypeAny> }; type: string }[] = [
  { block: heroBlock, schema: heroBlockSchema, type: 'hero' },
  { block: ctaStripBlock, schema: ctaStripBlockSchema, type: 'cta_strip' },
  { block: faqBlock, schema: faqBlockSchema, type: 'faq' },
];

for (const { block, schema, type } of DIRECT) {
  describe(`${type} block parity`, () => {
    it('slug matches the renderer section type', () => {
      expect(block.slug).toBe(type);
    });

    it('top-level field names match the Zod schema keys', () => {
      const fields = namedFields(block.fields)
        .map((f) => f.name)
        .sort();
      expect(fields).toEqual(Object.keys(schema.shape).sort());
    });

    it('required fields match the Zod non-optional keys', () => {
      for (const { name, required } of namedFields(block.fields)) {
        const zodField = schema.shape[name];
        expect(zodField, `Zod schema missing key ${name}`).toBeDefined();
        expect(required).toBe(!zodField!.isOptional());
      }
    });
  });
}

describe('rich_text block', () => {
  it('slug matches the renderer section type', () => {
    expect(richTextBlock.slug).toBe('rich_text');
  });

  it('authors content via a Lexical richText field (serialised to html in B23.4)', () => {
    const types = richTextBlock.fields.flatMap((f) => ('type' in f ? [f.type] : []));
    expect(types).toContain('richText');
  });

  it('exposes the align option the renderer supports', () => {
    const align = namedFields(richTextBlock.fields).find((f) => f.name === 'align');
    expect(align).toBeDefined();
  });
});

describe('the page block set', () => {
  it('exactly mirrors the renderer registry — no drift either way', () => {
    const blockSlugs = pageBlocks.map((b) => b.slug).sort();
    expect(blockSlugs).toEqual(Object.keys(BLOCK_REGISTRY).sort());
  });

  it('is wired into the Pages collection as the ordered `sections` field', () => {
    const sections = Pages.fields.find((f) => 'name' in f && f.name === 'sections');
    expect(sections).toBeDefined();
    expect((sections as { type?: string }).type).toBe('blocks');
  });
});
