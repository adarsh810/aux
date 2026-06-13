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

  const { data: room } = await supabaseServer
    .from('aux_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('host_id', host.id)
    .single();

  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 });
  }

  if (room.vetoes_remaining <= 0) {
    return Response.json({ error: 'No vetoes remaining' }, { status: 400 });
  }

  // Cancel active vote session
  await supabaseServer
    .from('aux_vote_sessions')
    .update({ status: 'failed' })
    .eq('room_id', room.id)
    .eq('status', 'active');

  // Decrement vetoes
  const { data: updatedRoom } = await supabaseServer
    .from('aux_rooms')
    .update({ vetoes_remaining: room.vetoes_remaining - 1 })
    .eq('id', room.id)
    .select()
    .single();

  return Response.json({ vetoes_remaining: updatedRoom?.vetoes_remaining });
}
