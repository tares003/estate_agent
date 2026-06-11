/**
 * The rendition key convention (EPIC-F FR-F-7): variants live beside the
 * original as `…/<name>.<variant>.<ext>`. Owned here — with the other storage
 * key rules — so the worker that writes renditions and the app that serves
 * them share one definition.
 */
export function variantKey(key: string, variant: 'thumb' | 'large'): string {
  const dot = key.lastIndexOf('.');
  return `${key.slice(0, dot)}.${variant}${key.slice(dot)}`;
}
