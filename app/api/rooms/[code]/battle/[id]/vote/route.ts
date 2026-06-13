import { supabaseServer } from '@/lib/supabase-server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  const { code, id: battleId } = await params;
  const body = await request.json();
  const { guestId, choice } = body;

  if (!guestId || !choice || !['a', 'b'].includes(choice)) {
    return Response.json({ error: 'guestId and choice (a or b) required' }, { status: 400 });
  }

  const { data: room } = await supabaseServer
    .from('aux_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 });
  }

  const { data: battle } = await supabaseServer
    .from('aux_battles')
    .select('*')
    .eq('id', battleId)
    .eq('room_id', room.id)
    .single();

  if (!battle) {
    return Response.json({ error: 'Battle not found' }, { status: 404 });
  }

  if (battle.status !== 'voting') {
    return Response.json({ error: 'Battle is not in voting phase' }, { status: 400 });
  }

  // Check already voted
  const { data: existingVote } = await supabaseServer
    .from('aux_battle_votes')
    .select('id')
    .eq('battle_id', battleId)
    .eq('guest_id', guestId)
    .single();

  if (existingVote) {
    return Response.json({ error: 'Already voted' }, { status: 400 });
  }

  // Insert vote
  await supabaseServer.from('aux_battle_votes').insert({
    battle_id: battleId,
    guest_id: guestId,
    choice,
  });

  const newVotesA = battle.votes_a + (choice === 'a' ? 1 : 0);
  const newVotesB = battle.votes_b + (choice === 'b' ? 1 : 0);

  // Get total guest count
  const { data: guests } = await supabaseServer
    .from('aux_guests')
    .select('id')
    .eq('room_id', room.id);
  const guestCount = guests?.length || 1;
  const totalVotes = newVotesA + newVotesB;

  let winner: string | null = null;
  let newStatus = 'voting';

  // Resolve if time expired or all voted
  const expired = battle.expires_at && new Date(battle.expires_at) < new Date();
  const allVoted = totalVotes >= guestCount;

  if (expired || allVoted) {
    winner = newVotesA >= newVotesB ? 'a' : 'b';
    newStatus = 'resolved';
  }

  const { data: updated } = await supabaseServer
    .from('aux_battles')
    .update({ votes_a: newVotesA, votes_b: newVotesB, winner, status: newStatus })
    .eq('id', battleId)
    .select()
    .single();

  // If resolved, add winning track to front of queue
  if (newStatus === 'resolved' && winner) {
    const winningTrack = winner === 'a' ? battle.track_a : battle.track_b;
    const winnerGuestId = winner === 'a' ? battle.suggested_by_a : battle.suggested_by_b;

    if (winningTrack) {
      // Get winner guest info
      const { data: winnerGuest } = await supabaseServer
        .from('aux_guests')
        .select('*')
        .eq('id', winnerGuestId)
        .single();

      // Shift all positions up
      const { data: existingQueue } = await supabaseServer
        .from('aux_queue')
        .select('id, position')
        .eq('room_id', room.id)
        .eq('status', 'queued')
        .order('position', { ascending: true });

      if (existingQueue && existingQueue.length > 0) {
        for (const item of existingQueue) {
          await supabaseServer
            .from('aux_queue')
            .update({ position: item.position + 1 })
            .eq('id', item.id);
        }
      }

      await supabaseServer.from('aux_queue').insert({
        room_id: room.id,
        track_uri: winningTrack.uri,
        track_name: winningTrack.name,
        track_artist: winningTrack.artists?.[0]?.name || 'Unknown',
        track_image: winningTrack.album?.images?.[0]?.url || null,
        track_duration_ms: winningTrack.duration_ms || null,
        suggested_by: winnerGuestId,
        suggested_by_name: winnerGuest?.name || 'Battle Winner',
        position: 0,
        status: 'queued',
      });
    }
  }

  return Response.json(updated);
}
