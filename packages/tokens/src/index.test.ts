import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { breakpoint, colour, motion, space, tokens, type } from './index.js';

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

/** Custom-property names DECLARED in tokens.css (lines like `  --name: value;`). */
function declaredVarNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const line of source.split(/\r?\n/)) {
    const match = /^\s*(--[a-z0-9-]+)\s*:/.exec(line);
    if (match?.[1]) names.add(match[1]);
  }
  return names;
}

/** Collect every leaf string in the accessor tree. */
function leaves(node: unknown, acc: string[] = []): string[] {
  if (typeof node === 'string') acc.push(node);
  else if (node && typeof node === 'object') {
    for (const value of Object.values(node)) leaves(value, acc);
  }
  return acc;
}

/** `--name` references pulled out of `var(--name)` accessor leaves. */
function referencedVarNames(node: unknown): Set<string> {
  const names = new Set<string>();
  for (const leaf of leaves(node)) {
    const match = /^var\((--[a-z0-9-]+)\)$/.exec(leaf);
    if (match?.[1]) names.add(match[1]);
  }
  return names;
}

describe('@estate/tokens accessor', () => {
  it('every accessor leaf is a single var(--token) reference (no raw values leak in)', () => {
    const nonVar = leaves(tokens).filter((leaf) => !/^var\(--[a-z0-9-]+\)$/.test(leaf));
    expect(nonVar, `non-var leaves: ${nonVar.join(', ')}`).toEqual([]);
  });

  it('maps every CSS custom property in tokens.css exactly once, with no extras', () => {
    const declared = declaredVarNames(css);
    const referenced = referencedVarNames(tokens);
    const missing = [...declared].filter((name) => !referenced.has(name)).sort();
    const extra = [...referenced].filter((name) => !declared.has(name)).sort();
    expect(missing, `accessor is missing tokens: ${missing.join(', ')}`).toEqual([]);
    expect(extra, `accessor references unknown tokens: ${extra.join(', ')}`).toEqual([]);
  });

  it('resolves representative token references to their CSS variables', () => {
    expect(colour.brand.primary).toBe('var(--colour-brand-primary)');
    expect(colour.status.soldStc).toBe('var(--colour-status-sold-stc)');
    expect(space[4]).toBe('var(--space-4)');
    expect(motion.duration.fast).toBe('var(--motion-duration-fast)');
    expect(motion.ease.standard).toBe('var(--motion-ease-standard)');
    expect(type.bodyMd.size).toBe('var(--text-body-md)');
    expect(type.bodyMd.lh).toBe('var(--text-body-md-lh)');
    expect(breakpoint['2xl']).toBe('var(--breakpoint-2xl)');
  });
});
