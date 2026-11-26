import { contentHash } from '@/lib/security/hash';
import type { NormalizedComment, NormalizedPost } from '@/lib/connectors/types';
import type { Platform } from '@/lib/types';
import {
  initialState,
  type CoverageCell,
  type SourceSyncState,
  type StoredComment,
  type StoredPost,
  type SyncRun,
  type SyncStore,
} from './types';

interface OrgData {
  state: SourceSyncState;
  posts: Map<string, StoredPost>;
  snapshots: Array<{
    postKey: string;
    at: string;
    metrics: NormalizedPost['metrics'];
  }>;
  comments: Map<string, StoredComment>;
  coverage: CoverageCell[];
  runs: SyncRun[];
}

const key = (platform: Platform, id: string) => `${platform}:${id}`;

/** Almacén en memoria aislado por organización (pruebas y simulación del modo demo). */
export class MemorySyncStore implements SyncStore {
  private readonly orgs = new Map<string, OrgData>();

  private org(orgId: string): OrgData {
    let d = this.orgs.get(orgId);
    if (!d) {
      d = {
        state: initialState(),
        posts: new Map(),
        snapshots: [],
        comments: new Map(),
        coverage: [],
        runs: [],
      };
      this.orgs.set(orgId, d);
    }
    return d;
  }

  async load(orgId: string) {
    return this.orgs.has(orgId) ? structuredClone(this.org(orgId).state) : null;
  }

  async save(orgId: string, patch: Partial<SourceSyncState>) {
    const d = this.org(orgId);
    d.state = { ...d.state, ...structuredClone(patch) };
  }

  async upsertPosts(orgId: string, posts: NormalizedPost[], at: string) {
    const d = this.org(orgId);
    let inserted = 0;
    let updated = 0;
    for (const p of posts) {
      const k = key(p.platform, p.externalId);
      const prev = d.posts.get(k);
      if (prev) {
        updated++;
        // Los medios ya completados desde los hilos no se pierden si la analítica trae menos.
        const media =
          (prev.media?.length ?? 0) > (p.media?.length ?? 0)
            ? prev.media
            : p.media;
        d.posts.set(k, {
          ...prev,
          ...p,
          media,
          firstSeenAt: prev.firstSeenAt,
          lastSeenAt: at,
        });
      } else {
        inserted++;
        d.posts.set(k, { ...p, firstSeenAt: at, lastSeenAt: at });
      }
      d.snapshots.push({ postKey: k, at, metrics: { ...p.metrics } });
    }
    return { inserted, updated, snapshots: posts.length };
  }

  async enrichPostMedia(
    orgId: string,
    platform: Platform,
    media: Map<string, string[]>,
  ) {
    const d = this.org(orgId);
    let n = 0;
    for (const [id, urls] of media) {
      const p = d.posts.get(key(platform, id));
      if (!p || urls.length <= (p.media?.length ?? 0)) continue;
      d.posts.set(key(platform, id), {
        ...p,
        contentType: urls.length > 1 ? 'carousel' : p.contentType,
        media: urls.map((u) => ({ kind: 'image' as const, sourceUrl: u })),
        mediaCountReported: urls.length,
      });
      n++;
    }
    return n;
  }

  async knownComments(orgId: string) {
    const d = this.org(orgId);
    const ids = new Set<string>();
    const authorHashes = new Set<string>();
    for (const c of d.comments.values()) {
      ids.add(c.externalId);
      authorHashes.add(`${c.authorExternalId ?? 'anon'}:${c.contentHash}`);
    }
    return { ids, authorHashes };
  }

  async insertComments(
    orgId: string,
    comments: Array<NormalizedComment & { contentHash: string }>,
    at: string,
  ) {
    const d = this.org(orgId);
    let n = 0;
    for (const c of comments) {
      const k = key(c.platform, c.externalId);
      if (d.comments.has(k)) continue; // idempotente (restricción única en la base)
      d.comments.set(k, {
        ...c,
        contentHash: c.contentHash ?? contentHash(c.body),
        importedAt: at,
      });
      n++;
    }
    return n;
  }

  async replaceCoverage(orgId: string, cells: CoverageCell[]) {
    this.org(orgId).coverage = structuredClone(cells);
  }

  async recordRun(orgId: string, run: SyncRun) {
    const d = this.org(orgId);
    d.runs.unshift(structuredClone(run));
    d.runs.length = Math.min(d.runs.length, 50);
  }

  async runs(orgId: string, limit = 10) {
    return structuredClone(this.org(orgId).runs.slice(0, limit));
  }

  async counts(orgId: string) {
    const d = this.org(orgId);
    return {
      posts: d.posts.size,
      comments: d.comments.size,
      snapshots: d.snapshots.length,
    };
  }

  async coverage(orgId: string) {
    return structuredClone(this.org(orgId).coverage);
  }

  async posts(orgId: string) {
    return structuredClone([...this.org(orgId).posts.values()]);
  }

  /** Solo pruebas/simulación: borra todo lo importado de la organización. */
  forget(orgId: string) {
    this.orgs.delete(orgId);
  }

  /** Interruptor global simulado (en Supabase vive en hf_runtime_flags). */
  killSwitch = false;
  readonly demoOrgs = new Set<string>();

  async globalKillSwitch() {
    return this.killSwitch;
  }

  async isDemoOrg(orgId: string) {
    return this.demoOrgs.has(orgId);
  }
}
