export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { supabaseServer } = await import('@/lib/supabase-server');

  const { data: room, error: roomError } = await supabaseServer
    .from('aux_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (roomError || !room) {
    return Response.json({ error: 'Room not found' }, { status: 404 });
  }

  const [guestsResult, queueResult, voteResult, battleResult] = await Promise.all([
    supabaseServer
      .from('aux_guests')
      .select('*')
      .eq('room_id', room.id)
      .order('joined_at', { ascending: true }),
    supabaseServer
      .from('aux_queue')
      .select('*')
      .eq('room_id', room.id)
      .eq('status', 'queued')
      .order('position', { ascending: true }),
    supabaseServer
      .from('aux_vote_sessions')
      .select('*')
      .eq('room_id', room.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1),
    supabaseServer
      .from('aux_battles')
      .select('*')
      .eq('room_id', room.id)
      .in('status', ['waiting_b', 'voting'])
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  return Response.json({
    room,
    guests: guestsResult.data || [],
    queue: queueResult.data || [],
    activeVote: voteResult.data?.[0] || null,
    activeBattle: battleResult.data?.[0] || null,
  });
}
