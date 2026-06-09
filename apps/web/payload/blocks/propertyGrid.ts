// pack: core — property_grid is a core page-builder block. The listingType
// options enumerate the §J ListingType values (incl. vertical-pack verticals like
// new_home/commercial) purely as catalogue FILTERS; the block neither enables nor
// gates a vertical pack — a tenant without a pack simply has no such properties,
// so the filter yields an empty grid. No requirePack gate is needed (CLAUDE.md §9
// EPIC-AD / PRODUCT.md §5a).
import type { Block } from 'payload';

// CMS authoring schema for `property_grid` (FR-D-2). Filter config — the renderer
// (components/blocks/PropertyGridBlock.tsx) fetches matching published properties.
// Field names mirror propertyGridBlockSchema in property-grid-options.ts (enforced
// by blocks.test.ts). listingType values track the §J ListingType enum.
export const propertyGridBlock: Block = {
  slug: 'property_grid',
  interfaceName: 'PropertyGridBlock',
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'saleType',
      type: 'select',
      options: [
        { label: 'For sale', value: 'sale' },
        { label: 'To rent', value: 'rent' },
      ],
      admin: { description: 'Limit to sale or rent listings (leave empty for both).' },
    },
    {
      name: 'listingType',
      type: 'select',
      options: [
        { label: 'Residential', value: 'residential' },
        { label: 'New home', value: 'new_home' },
        { label: 'Commercial', value: 'commercial' },
        { label: 'Business transfer', value: 'business_transfer' },
        { label: 'Care home', value: 'care_home' },
        { label: 'Land', value: 'land' },
      ],
    },
    {
      name: 'limit',
      type: 'number',
      min: 1,
      max: 24,
      admin: { description: 'How many properties to show (default 6).' },
    },
  ],
};
