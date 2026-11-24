import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Invariante del seed QA: un comentario vive en la red de su publicación (Fase A, punto 9).
 * La revisión del Preview V2 encontró comentarios de Facebook en una publicación de Instagram.
 */
const seed = readFileSync(
  join(__dirname, '../supabase/seed/qa_seed.sql'),
  'utf8',
);

describe('seed QA: coherencia comentario–publicación', () => {
  const posts = new Map(
    [...seed.matchAll(/'(\w+)',\s+'(qa-post-[ab]-\d)'/g)].map((m) => [
      m[2]!,
      m[1]!,
    ]),
  );
  const comments = [
    ...seed.matchAll(
      /\('9[ab]000000-0000-4000-a000-0000000000[ab]1','(qa-c-[ab]-\d+)','(\w+)','(qa-post-[ab]-\d)'/g,
    ),
  ].map((m) => ({ ext: m[1]!, platform: m[2]!, post: m[3]! }));

  it('lee publicaciones y comentarios del seed', () => {
    expect(posts.size).toBe(5);
    expect(comments.length).toBeGreaterThanOrEqual(20);
  });
  it('cada comentario está en la misma red que su publicación', () => {
    const bad = comments.filter((c) => posts.get(c.post) !== c.platform);
    expect(bad).toEqual([]);
  });
});
