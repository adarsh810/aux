import { getHostFromRequest } from '@/lib/auth';
import { refreshTokenIfNeeded, getDevices } from '@/lib/spotify';
import type { Host } from '@/lib/types';

export async function GET(request: Request) {
  const host = await getHostFromRequest(request);
  if (!host) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const accessToken = await refreshTokenIfNeeded(host as Host);
    const devices = await getDevices(accessToken);
    return Response.json(devices);
  } catch (err) {
    return Response.json({ error: 'Failed to fetch devices', detail: String(err) }, { status: 500 });
  }
}
