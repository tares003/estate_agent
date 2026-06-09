import { Fragment } from 'react';
import { BLOCK_REGISTRY } from './registry.js';

// EPIC-D page renderer (FR-D-1): renders a page's ordered sections by looking each
// type up in the block registry and validating its stored data before rendering.
// Unknown types and sections whose data fails validation are skipped (fail-soft),
// so one bad section never breaks the page.

/** One stored page section: a registered type + its (unvalidated) JSON data. */
export interface PageSection {
  type: string;
  data: unknown;
}

export interface PageRendererProps {
  sections: PageSection[];
}

export function PageRenderer({ sections }: PageRendererProps) {
  return (
    <>
      {sections.map((section, index) => {
        const block = BLOCK_REGISTRY[section.type];
        if (!block) return null;
        const parsed = block.schema.safeParse(section.data);
        if (!parsed.success) return null;
        const { Component } = block;
        return (
          <Fragment key={`${section.type}-${index}`}>
            <Component data={parsed.data} />
          </Fragment>
        );
      })}
    </>
  );
}
