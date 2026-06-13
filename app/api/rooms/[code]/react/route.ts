import { supabaseServer } from '@/lib/supabase-server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { searchParams } = new URL(request.url);
  const trackUri = searchParams.get('trackUri');

  const { data: room } = await supabaseServer
    .from('aux_rooms')
    .select('id')
    .eq('code', code.toUpperCase())
    .single();

  if (!room || !trackUri) return Response.json({ fire: 0, skull: 0, dance: 0 });

  const { data: reactions } = await supabaseServer
    .from('aux_reactions')
    .select('type')
    .eq('room_id', room.id)
    .eq('track_uri', trackUri);

  return Response.json({
    fire: reactions?.filter(r => r.type === 'fire').length || 0,
    skull: reactions?.filter(r => r.type === 'skull').length || 0,
    dance: reactions?.filter(r => r.type === 'dance').length || 0,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const body = await request.json();
  const { type, guestId, trackUri } = body;

  if (!type || !guestId || !trackUri) {
    return Response.json({ error: 'type, guestId, trackUri required' }, { status: 400 });
  }

  if (!['fire', 'skull', 'dance'].includes(type)) {
    return Response.json({ error: 'Invalid reaction type' }, { status: 400 });
  }

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

  // Get existing reaction for this guest + track
  const { data: existing } = await supabaseServer
    .from('aux_reactions')
    .select('*')
    .eq('room_id', room.id)
    .eq('track_uri', trackUri)
    .eq('guest_id', guestId)
    .single();

  // Upsert reaction
  await supabaseServer
    .from('aux_reactions')
    .upsert(
      {
        room_id: room.id,
        track_uri: trackUri,
        guest_id: guestId,
        type,
      },
      { onConflict: 'room_id,track_uri,guest_id' }
    );

  // If fire reaction and aux holder exists, award 1 credit
  if (type === 'fire' && room.current_aux_holder_id && existing?.type !== 'fire') {
    const { data: auxHolder } = await supabaseServer
      .from('aux_guests')
      .select('*')
      .eq('id', room.current_aux_holder_id)
      .single();

    if (auxHolder) {
      await supabaseServer
        .from('aux_guests')
        .update({ credits: auxHolder.credits + 1 })
        .eq('id', auxHolder.id);
    }
  }

  // Update aux_played reaction counts
  const { data: played } = await supabaseServer
    .from('aux_played')
    .select('*')
    .eq('room_id', room.id)
    .eq('track_uri', trackUri)
    .order('played_at', { ascending: false })
    .limit(1)
    .single();

  if (played) {
    // Recount from reactions table
    const { data: allReactions } = await supabaseServer
      .from('aux_reactions')
      .select('type')
      .eq('room_id', room.id)
      .eq('track_uri', trackUri);

    const fire_count = allReactions?.filter(r => r.type === 'fire').length || 0;
    const skull_count = allReactions?.filter(r => r.type === 'skull').length || 0;
    const dance_count = allReactions?.filter(r => r.type === 'dance').length || 0;

    await supabaseServer
      .from('aux_played')
      .update({ fire_count, skull_count, dance_count })
      .eq('id', played.id);
  }

  // Return reaction counts
  const { data: allReactions } = await supabaseServer
    .from('aux_reactions')
    .select('type')
    .eq('room_id', room.id)
    .eq('track_uri', trackUri);

  const fire = allReactions?.filter(r => r.type === 'fire').length || 0;
  const skull = allReactions?.filter(r => r.type === 'skull').length || 0;
  const dance = allReactions?.filter(r => r.type === 'dance').length || 0;

  return Response.json({ fire, skull, dance });
}
