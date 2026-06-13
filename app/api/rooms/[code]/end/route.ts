import { supabaseServer } from '@/lib/supabase-server';
import { getHostFromRequest } from '@/lib/auth';
import type { WrappedSummary } from '@/lib/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const host = await getHostFromRequest(request);
  if (!host) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: room } = await supabaseServer
    .from('aux_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('host_id', host.id)
    .single();

  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 });
  }

  // Gather data for wrapped BEFORE marking ended (realtime fires on status change)
  const [playedResult, guestsResult, voteSessionsResult] = await Promise.all([
    supabaseServer.from('aux_played').select('*').eq('room_id', room.id).order('played_at'),
    supabaseServer.from('aux_guests').select('*').eq('room_id', room.id),
    supabaseServer
      .from('aux_vote_sessions')
      .select('*')
      .eq('room_id', room.id)
      .eq('type', 'skip'),
  ]);

  const played = playedResult.data || [];
  const guests = guestsResult.data || [];
  const skipVotes = voteSessionsResult.data || [];

  // Biggest banger
  const biggestBanger = played.reduce(
    (best, track) => (!best || track.fire_count > best.fire_count ? track : best),
    null as (typeof played)[0] | null
  );

  // Most booed
  const mostBooed = played.reduce(
    (worst, track) => (!worst || track.skull_count > worst.skull_count ? track : worst),
    null as (typeof played)[0] | null
  );

  // Best/worst taste (avg fire - skull per guest)
  const guestScores: Record<string, { name: string; scores: number[] }> = {};
  for (const track of played) {
    if (track.played_by && track.played_by_name) {
      if (!guestScores[track.played_by]) {
        guestScores[track.played_by] = { name: track.played_by_name, scores: [] };
      }
      guestScores[track.played_by].scores.push(track.fire_count - track.skull_count);
    }
  }

  let bestTaste: { guest_name: string; avg_score: number } | null = null;
  let worstTaste: { guest_name: string; avg_score: number } | null = null;

  for (const [, { name, scores }] of Object.entries(guestScores)) {
    if (scores.length === 0) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (!bestTaste || avg > bestTaste.avg_score) {
      bestTaste = { guest_name: name, avg_score: avg };
    }
    if (!worstTaste || avg < worstTaste.avg_score) {
      worstTaste = { guest_name: name, avg_score: avg };
    }
  }

  // Power user (lowest credits = spent most; started at 10)
  const powerUser = guests.reduce(
    (min, g) => (!min || g.credits < min.credits ? g : min),
    null as (typeof guests)[0] | null
  );

  // Top bouncer (most skip votes initiated)
  const skipCounts: Record<string, { name: string; count: number }> = {};
  for (const sv of skipVotes) {
    if (sv.initiated_by) {
      const guest = guests.find(g => g.id === sv.initiated_by);
      if (guest) {
        if (!skipCounts[sv.initiated_by]) {
          skipCounts[sv.initiated_by] = { name: guest.name, count: 0 };
        }
        skipCounts[sv.initiated_by].count++;
      }
    }
  }

  let topBouncer: { guest_name: string; skip_votes: number } | null = null;
  for (const { name, count } of Object.values(skipCounts)) {
    if (!topBouncer || count > topBouncer.skip_votes) {
      topBouncer = { guest_name: name, skip_votes: count };
    }
  }

  const summary: WrappedSummary = {
    total_guests: guests.length,
    total_tracks: played.length,
    party_date: room.created_at,
    biggest_banger: biggestBanger
      ? {
          track_name: biggestBanger.track_name || 'Unknown',
          track_artist: biggestBanger.track_artist || 'Unknown',
          track_image: biggestBanger.track_image,
          fire_count: biggestBanger.fire_count,
        }
      : null,
    most_booed: mostBooed
      ? {
          track_name: mostBooed.track_name || 'Unknown',
          track_artist: mostBooed.track_artist || 'Unknown',
          track_image: mostBooed.track_image,
          skull_count: mostBooed.skull_count,
        }
      : null,
    best_taste: bestTaste,
    worst_taste: worstTaste,
    power_user: powerUser
      ? {
          guest_name: powerUser.name,
          credits_spent: 10 - powerUser.credits,
        }
      : null,
    top_bouncer: topBouncer,
    tracks: played,
  };

  const { data: wrapped, error } = await supabaseServer
    .from('aux_wrapped')
    .insert({
      room_id: room.id,
      host_id: host.id,
      summary,
    })
    .select()
    .single();

  if (error || !wrapped) {
    return Response.json({ error: 'Failed to save wrapped' }, { status: 500 });
  }

  // Mark room ended AFTER wrapped is saved so guests can load the recap
  await supabaseServer
    .from('aux_rooms')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', room.id);

  return Response.json({ wrapped, roomId: room.id });
}
