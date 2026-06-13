import { getHostFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const host = await getHostFromRequest(request);
  if (!host) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Don't expose tokens
  const { access_token: _, refresh_token: __, ...safeHost } = host;
  return Response.json(safeHost);
}
