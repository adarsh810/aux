import { supabaseServer } from '@/lib/supabase-server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const { data: room } = await supabaseServer
    .from('aux_rooms')
    .select('id')
    .eq('code', code.toUpperCase())
    .single();

  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 });
  }

  const { data: queue } = await supabaseServer
    .from('aux_queue')
    .select('*')
    .eq('room_id', room.id)
    .eq('status', 'queued')
    .order('position', { ascending: true });

  return Response.json(queue || []);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const body = await request.json();
  const { trackUri, trackName, trackArtist, trackImage, trackDurationMs, guestId } = body;

  if (!trackUri || !trackName || !trackArtist || !guestId) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data: room } = await supabaseServer
    .from('aux_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 });
  }

  if (room.status !== 'active') {
    return Response.json({ error: 'Room is not active' }, { status: 400 });
  }

  // Verify guest
  const { data: guest } = await supabaseServer
    .from('aux_guests')
    .select('*')
    .eq('id', guestId)
    .eq('room_id', room.id)
    .single();

  if (!guest) {
    return Response.json({ error: 'Guest not found' }, { status: 404 });
  }

  if (guest.is_muted) {
    return Response.json({ error: 'You are muted' }, { status: 403 });
  }

  if (guest.credits < 1) {
    return Response.json({ error: 'Insufficient credits' }, { status: 400 });
  }

  // Check per-person limit (max 2 songs in queue at once)
  const { data: existingByGuest } = await supabaseServer
    .from('aux_queue')
    .select('id')
    .eq('room_id', room.id)
    .eq('suggested_by', guestId)
    .eq('status', 'queued');

  if (existingByGuest && existingByGuest.length >= 2) {
    return Response.json({ error: 'You already have 2 songs in the queue' }, { status: 400 });
  }

  // Check no duplicate in current queue
  const { data: duplicate } = await supabaseServer
    .from('aux_queue')
    .select('id')
    .eq('room_id', room.id)
    .eq('track_uri', trackUri)
    .eq('status', 'queued')
    .single();

  if (duplicate) {
    return Response.json({ error: 'Track is already in the queue' }, { status: 400 });
  }

  // Get next position
  const { data: lastItem } = await supabaseServer
    .from('aux_queue')
    .select('position')
    .eq('room_id', room.id)
    .eq('status', 'queued')
    .order('position', { ascending: false })
    .limit(1)
    .single();

  const position = (lastItem?.position ?? -1) + 1;

  // Insert queue item
  const { data: queueItem, error: insertError } = await supabaseServer
    .from('aux_queue')
    .insert({
      room_id: room.id,
      track_uri: trackUri,
      track_name: trackName,
      track_artist: trackArtist,
      track_image: trackImage || null,
      track_duration_ms: trackDurationMs || null,
      suggested_by: guestId,
      suggested_by_name: guest.name,
      position,
      status: 'queued',
    })
    .select()
    .single();

  if (insertError || !queueItem) {
    return Response.json({ error: 'Failed to add to queue' }, { status: 500 });
  }

  // Deduct 1 credit
  await supabaseServer
    .from('aux_guests')
    .update({ credits: guest.credits - 1 })
    .eq('id', guestId);

  return Response.json(queueItem);
}
