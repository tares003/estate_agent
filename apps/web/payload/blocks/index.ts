import type { Block } from 'payload';

import { calculatorBlock } from './calculator.js';
import { ctaStripBlock } from './ctaStrip.js';
import { faqBlock } from './faq.js';
import { heroBlock } from './hero.js';
import { richTextBlock } from './richText.js';
import { propertyGridBlock } from './propertyGrid.js';
import { statsRowBlock } from './statsRow.js';
import { testimonialsBlock } from './testimonials.js';
import { threePillarBlock } from './threePillar.js';
import { twoColumnBlock } from './twoColumn.js';

export {
  calculatorBlock,
  ctaStripBlock,
  faqBlock,
  heroBlock,
  propertyGridBlock,
  richTextBlock,
  statsRowBlock,
  testimonialsBlock,
  threePillarBlock,
  twoColumnBlock,
};

// The V1 page-builder block set (FR-D-2 subset). Order here is the order shown in
// the CMS "add section" menu. blocks.test.ts asserts this set exactly mirrors the
// renderer registry (components/blocks/registry.ts) — no drift in either direction.
export const pageBlocks: Block[] = [
  heroBlock,
  calculatorBlock,
  richTextBlock,
  ctaStripBlock,
  faqBlock,
  threePillarBlock,
  statsRowBlock,
  testimonialsBlock,
  twoColumnBlock,
  propertyGridBlock,
];
