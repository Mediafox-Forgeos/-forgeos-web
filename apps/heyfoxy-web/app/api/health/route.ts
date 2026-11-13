import { dataMode, whatsappMode } from '@/lib/env';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({
    ok: true,
    app: 'heyfoxy-web',
    sha:
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.HF_BUILD_SHA ?? 'local',
    dataMode: dataMode(),
    whatsappMode: whatsappMode(),
    connectors: {
      metricool: process.env.HF_CONNECTOR_METRICOOL_ENABLED === 'true',
      meta: process.env.HF_CONNECTOR_META_ENABLED === 'true',
      youtube: process.env.HF_CONNECTOR_YOUTUBE_ENABLED === 'true',
    },
  });
}
