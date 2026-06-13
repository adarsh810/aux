import { getHostFromRequest } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const host = await getHostFromRequest(request);
  if (!host) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: wrapped, error } = await supabaseServer
    .from('aux_wrapped')
    .select('*')
    .eq('host_id', host.id)
    .order('created_at', { ascending: false });

  if (error) {
    return Response.json({ error: 'Failed to fetch history' }, { status: 500 });
  }

  return Response.json(wrapped || []);
}
