import { supabaseServer } from '@/lib/supabase-server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const body = await request.json();
  const { action, guestId, trackA, trackB } = body;

  const { data: room } = await supabaseServer
    .from('aux_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 });
  }

  const { data: guest } = await supabaseServer
    .from('aux_guests')
    .select('*')
    .eq('id', guestId)
    .eq('room_id', room.id)
    .single();

  if (!guest) {
    return Response.json({ error: 'Guest not found' }, { status: 404 });
  }

  if (action === 'start') {
    if (!trackA) {
      return Response.json({ error: 'trackA required' }, { status: 400 });
    }

    // Check no active battle
    const { data: existing } = await supabaseServer
      .from('aux_battles')
      .select('id')
      .eq('room_id', room.id)
      .in('status', ['waiting_b', 'voting'])
      .single();

    if (existing) {
      return Response.json({ error: 'A battle is already in progress' }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + 30000).toISOString();

    const { data: battle, error } = await supabaseServer
      .from('aux_battles')
      .insert({
        room_id: room.id,
        track_a: trackA,
        track_b: null,
        suggested_by_a: guestId,
        status: 'waiting_b',
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error || !battle) {
      return Response.json({ error: 'Failed to start battle' }, { status: 500 });
    }

    return Response.json(battle);
  }

  if (action === 'submit_b') {
    const { battleId } = body;
    if (!battleId || !trackB) {
      return Response.json({ error: 'battleId and trackB required' }, { status: 400 });
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

    if (battle.status !== 'waiting_b') {
      return Response.json({ error: 'Battle is not waiting for track B' }, { status: 400 });
    }

    if (battle.suggested_by_a === guestId) {
      return Response.json({ error: 'Cannot battle your own track' }, { status: 400 });
    }

    const votingExpiresAt = new Date(Date.now() + 30000).toISOString();

    const { data: updated, error } = await supabaseServer
      .from('aux_battles')
      .update({
        track_b: trackB,
        suggested_by_b: guestId,
        status: 'voting',
        expires_at: votingExpiresAt,
      })
      .eq('id', battleId)
      .select()
      .single();

    if (error || !updated) {
      return Response.json({ error: 'Failed to update battle' }, { status: 500 });
    }

    return Response.json(updated);
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}
