import { supabaseServer } from '@/lib/supabase-server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  const { data: wrapped, error } = await supabaseServer
    .from('aux_wrapped')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !wrapped) {
    return Response.json({ error: 'Wrapped not found' }, { status: 404 });
  }

  return Response.json(wrapped);
}
