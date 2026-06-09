import type { ReactNode } from 'react';
import type { ZodType, ZodTypeAny } from 'zod';
import { HeroBlock, heroBlockSchema } from './HeroBlock.js';
import { RichTextBlock, richTextBlockSchema } from './RichTextBlock.js';
import { CtaStripBlock, ctaStripBlockSchema } from './CtaStripBlock.js';
import { FaqBlock, faqBlockSchema } from './FaqBlock.js';
import { ThreePillarBlock, threePillarBlockSchema } from './ThreePillarBlock.js';
import { StatsRowBlock, statsRowBlockSchema } from './StatsRowBlock.js';
import { TestimonialsBlock, testimonialsBlockSchema } from './TestimonialsBlock.js';
import { TwoColumnBlock, twoColumnBlockSchema } from './TwoColumnBlock.js';
import { PropertyGridBlock } from './PropertyGridBlock.js';
import { propertyGridBlockSchema } from './property-grid-options.js';

// The EPIC-D section-type registry (FR-D-1/2): maps a section `type` to its data
// schema + renderer. The page renderer validates each section's stored data
// against the schema before rendering, so a malformed or unknown section fails
// soft (renders nothing) rather than breaking the page. The Payload Block configs
// in payload/blocks/* mirror these schemas one-for-one.

/** A block renderer — sync (presentational) or async (data-fetching, e.g. property_grid). */
export type BlockComponent<T> = (props: { data: T }) => ReactNode | Promise<ReactNode>;

/** A registered block: its data schema + a renderer that accepts validated data. */
export interface RegisteredBlock {
  schema: ZodTypeAny;
  Component: BlockComponent<unknown>;
}

/** Pair a typed schema with its typed renderer, erasing the data type for the registry. */
function defineBlock<T>(schema: ZodType<T>, Component: BlockComponent<T>): RegisteredBlock {
  return { schema, Component: Component as BlockComponent<unknown> };
}

export const BLOCK_REGISTRY: Readonly<Record<string, RegisteredBlock>> = {
  hero: defineBlock(heroBlockSchema, HeroBlock),
  rich_text: defineBlock(richTextBlockSchema, RichTextBlock),
  cta_strip: defineBlock(ctaStripBlockSchema, CtaStripBlock),
  faq: defineBlock(faqBlockSchema, FaqBlock),
  three_pillar: defineBlock(threePillarBlockSchema, ThreePillarBlock),
  stats_row: defineBlock(statsRowBlockSchema, StatsRowBlock),
  testimonials: defineBlock(testimonialsBlockSchema, TestimonialsBlock),
  two_column: defineBlock(twoColumnBlockSchema, TwoColumnBlock),
  property_grid: defineBlock(propertyGridBlockSchema, PropertyGridBlock),
};

/** The section types the render layer currently supports. */
export const SUPPORTED_BLOCK_TYPES = Object.keys(BLOCK_REGISTRY);
