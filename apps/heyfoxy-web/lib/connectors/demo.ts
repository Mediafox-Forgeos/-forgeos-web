import type { Platform } from '@/lib/types';
import type {
  AuthorizationCheck,
  FetchPage,
  FetchWindow,
  NormalizedComment,
  NormalizedPost,
  ProviderCapability,
  SourceConnector,
} from './types';

/** Proveedor de DATOS FICTICIOS. Todo lo que produce se marca is_synthetic. */
export class DemoConnector implements SourceConnector {
  readonly provider = 'demo' as const;
  readonly displayName = 'Datos de demostración (ficticios)';
  constructor(private readonly comments: NormalizedComment[] = []) {}
  isEnabled() {
    return true;
  }
  capabilities(): ProviderCapability[] {
    return (['instagram', 'facebook', 'x'] as Platform[]).map((platform) => ({
      platform,
      dataKind: 'comments',
      maxCoverage: 'complete',
      ownership: 'owned',
      note: 'Datos sintéticos para demostración',
    }));
  }
  async checkAuthorizations(
    platforms: Platform[],
  ): Promise<AuthorizationCheck[]> {
    return platforms.map((platform) => ({
      platform,
      dataKind: 'comments',
      granted: true,
      detail: 'Demo',
    }));
  }
  async fetchPosts(): Promise<FetchPage<NormalizedPost>> {
    return { items: [], nextCursor: null };
  }
  async fetchComments(
    platform: Platform,
    w: FetchWindow,
  ): Promise<FetchPage<NormalizedComment>> {
    return {
      items: this.comments
        .filter((c) => c.platform === platform)
        .slice(0, w.limit),
      nextCursor: null,
    };
  }
}
