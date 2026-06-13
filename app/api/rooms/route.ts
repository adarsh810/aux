import { getHostFromRequest } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: Request) {
  const host = await getHostFromRequest(request);
  if (!host) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { deviceId, deviceName } = body;

  if (!deviceId) {
    return Response.json({ error: 'deviceId is required' }, { status: 400 });
  }

  // Generate unique code
  let code = generateRoomCode();
  let attempts = 0;
  while (attempts < 10) {
    const { data: existing } = await supabaseServer
      .from('aux_rooms')
      .select('id')
      .eq('code', code)
      .single();
    if (!existing) break;
    code = generateRoomCode();
    attempts++;
  }

  const { data: room, error } = await supabaseServer
    .from('aux_rooms')
    .insert({
      code,
      host_id: host.id,
      status: 'active',
      device_id: deviceId,
      device_name: deviceName || null,
    })
    .select()
    .single();

  if (error || !room) {
    return Response.json({ error: 'Failed to create room' }, { status: 500 });
  }

  return Response.json({ code: room.code, roomId: room.id });
}
