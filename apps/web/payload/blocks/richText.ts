import type { Block } from 'payload';

// CMS authoring schema for the `rich_text` section. Unlike the other blocks this
// is NOT a 1:1 field mirror: the editor authors in Lexical (the `content`
// richText field, inheriting the config-level lexicalEditor), and B23.4
// serialises that to the sanitised `html` string richTextBlockSchema expects.
// `align` maps straight to the renderer's align option.
export const richTextBlock: Block = {
  slug: 'rich_text',
  interfaceName: 'RichTextBlock',
  fields: [
    { name: 'content', type: 'richText' },
    {
      name: 'align',
      type: 'select',
      defaultValue: 'left',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
      ],
    },
  ],
};
