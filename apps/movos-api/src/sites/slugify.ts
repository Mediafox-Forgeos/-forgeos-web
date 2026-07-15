/**
 * Minimal, dependency-free slugifier. Lowercases, strips diacritics, replaces
 * non-alphanumerics with hyphens and collapses/trims separators.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
