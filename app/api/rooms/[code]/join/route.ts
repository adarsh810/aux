import { supabaseServer } from '@/lib/supabase-server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const body = await request.json();
  const { name, sessionId } = body;

  if (!name || !sessionId) {
    return Response.json({ error: 'name and sessionId are required' }, { status: 400 });
  }

  const { data: room, error: roomError } = await supabaseServer
    .from('aux_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (roomError || !room) {
    return Response.json({ error: 'Room not found' }, { status: 404 });
  }

  if (room.status === 'ended') {
    return Response.json({ error: 'Party has ended' }, { status: 400 });
  }

  const { data: guest, error: guestError } = await supabaseServer
    .from('aux_guests')
    .upsert(
      {
        room_id: room.id,
        session_id: sessionId,
        name: name.trim().slice(0, 30),
        credits: 10,
        is_muted: false,
      },
      { onConflict: 'room_id,session_id' }
    )
    .select()
    .single();

  if (guestError || !guest) {
    return Response.json({ error: 'Failed to join room' }, { status: 500 });
  }

  return Response.json({ guestId: guest.id, guest });
}
