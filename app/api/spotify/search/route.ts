import { NextRequest } from 'next/server';
import { getHostFromRequest } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';
import { refreshTokenIfNeeded, search } from '@/lib/spotify';
import type { Host, SpotifyTrack } from '@/lib/types';

const VIBE_PATTERN = /\b(vibe|mood|feel|something|music for|sounds like|energy|chill|hype|party|sad|happy|workout|driving|night|ambient|groovy|upbeat|mellow|banger|indie|jazz|blues|soul|funk|trap|afrobeat|reggae|classical|lofi|lo-fi|90s|80s|2000s|throwback|nostalgic)\b/i;

function isVibeQuery(q: string): boolean {
  return q.split(/\s+/).length > 4 || VIBE_PATTERN.test(q);
}

async function expandVibeQuery(q: string): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [q];

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Convert this party music vibe into 3 specific Spotify search queries. Return ONLY a JSON array of strings.\n\nVibe: "${q}"\n\nExample: ["late night R&B Drake", "chill trap 2020", "lo-fi hip hop study"]`,
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [q];
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? (parsed as string[]).slice(0, 3) : [q];
  } catch {
    return [q];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q');
  const roomCode = searchParams.get('code');

  if (!q) {
    return Response.json({ error: 'q parameter required' }, { status: 400 });
  }

  let host: Host | null = null;

  host = await getHostFromRequest(request);

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

    if (isVibeQuery(q)) {
      const queries = await expandVibeQuery(q);
      const results = await Promise.all(queries.map(qry => search(accessToken, qry).catch(() => [] as SpotifyTrack[])));
      const seen = new Set<string>();
      const merged = results.flat().filter(t => {
        if (seen.has(t.uri)) return false;
        seen.add(t.uri);
        return true;
      });
      return Response.json(merged.slice(0, 15));
    }

    const tracks = await search(accessToken, q);
    return Response.json(tracks);
  } catch (err) {
    return Response.json({ error: 'Search failed', detail: String(err) }, { status: 500 });
  }
}
