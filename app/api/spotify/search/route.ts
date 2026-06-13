import { NextRequest } from 'next/server';
import { getHostFromRequest } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';
import { refreshTokenIfNeeded, search } from '@/lib/spotify';
import type { Host } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q');
  const roomCode = searchParams.get('code');

  if (!q) {
    return Response.json({ error: 'q parameter required' }, { status: 400 });
  }

  let host: Host | null = null;

  // Try host cookie first
  host = await getHostFromRequest(request);

  // Fall back to finding host by room code
  if (!host && roomCode) {
    const { data: room } = await supabaseServer
      .from('aux_rooms')
      .select('host_id')
      .eq('code', roomCode.toUpperCase())
      .single();

    if (room?.host_id) {
      const { data: hostData } = await supabaseServer
        .from('aux_hosts')
        .select('*')
        .eq('id', room.host_id)
        .single();
      host = hostData as Host | null;
    }
  }

  if (!host) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const accessToken = await refreshTokenIfNeeded(host);
    const tracks = await search(accessToken, q);
    return Response.json(tracks);
  } catch (err) {
    return Response.json({ error: 'Search failed', detail: String(err) }, { status: 500 });
  }
}
