import { supabaseServer } from '@/lib/supabase-server';
import { getHostFromRequest } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const host = await getHostFromRequest(request);
  if (!host) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { guestId, muted } = body;

  if (!guestId || muted === undefined) {
    return Response.json({ error: 'guestId and muted required' }, { status: 400 });
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

  const { data: guest, error } = await supabaseServer
    .from('aux_guests')
    .update({ is_muted: muted })
    .eq('id', guestId)
    .eq('room_id', room.id)
    .select()
    .single();

  if (error || !guest) {
    return Response.json({ error: 'Failed to update guest' }, { status: 500 });
  }

  return Response.json(guest);
}
