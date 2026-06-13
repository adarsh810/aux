import { supabaseServer } from '@/lib/supabase-server';
import { getHostFromRequest } from '@/lib/auth';
import { refreshTokenIfNeeded, skipTrack } from '@/lib/spotify';
import type { Host } from '@/lib/types';

const VOTE_COSTS: Record<string, number> = {
  skip: 2,
  challenge: 3,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const body = await request.json();
  const { action, guestId, vote, targetId } = body;

  const { data: room } = await supabaseServer
    .from('aux_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (!room) {
    return Response.json({ error: 'Room not found' }, { status: 404 });
  }

  if (action === 'initiate') {
    const { type } = body;
    if (!guestId || !type) {
      return Response.json({ error: 'guestId and type required' }, { status: 400 });
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

    const cost = VOTE_COSTS[type];
    if (!cost) {
      return Response.json({ error: 'Invalid vote type' }, { status: 400 });
    }

    if (guest.credits < cost) {
      return Response.json({ error: 'Insufficient credits' }, { status: 400 });
    }

    // Check no active vote
    const { data: activeVote } = await supabaseServer
      .from('aux_vote_sessions')
      .select('id')
      .eq('room_id', room.id)
      .eq('status', 'active')
      .single();

    if (activeVote) {
      return Response.json({ error: 'A vote is already in progress' }, { status: 400 });
    }

    // Count guests for required threshold
    const { data: guests } = await supabaseServer
      .from('aux_guests')
      .select('id')
      .eq('room_id', room.id);

    const guestCount = guests?.length || 1;
    const required = Math.ceil(guestCount / 2);

    const expiresAt = new Date(Date.now() + 15000).toISOString();

    const { data: voteSession, error: vsError } = await supabaseServer
      .from('aux_vote_sessions')
      .insert({
        room_id: room.id,
        type,
        initiated_by: guestId,
        target_id: targetId || null,
        yes_votes: 0,
        no_votes: 0,
        required,
        status: 'active',
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (vsError || !voteSession) {
      return Response.json({ error: 'Failed to create vote' }, { status: 500 });
    }

    // Deduct credits
    await supabaseServer
      .from('aux_guests')
      .update({ credits: guest.credits - cost })
      .eq('id', guestId);

    return Response.json(voteSession);
  }

  if (action === 'cast') {
    const { voteSessionId } = body;
    if (!guestId || !voteSessionId || vote === undefined) {
      return Response.json({ error: 'guestId, voteSessionId, vote required' }, { status: 400 });
    }

    const { data: voteSession } = await supabaseServer
      .from('aux_vote_sessions')
      .select('*')
      .eq('id', voteSessionId)
      .eq('room_id', room.id)
      .single();

    if (!voteSession) {
      return Response.json({ error: 'Vote session not found' }, { status: 404 });
    }

    if (voteSession.status !== 'active') {
      return Response.json({ error: 'Vote is no longer active' }, { status: 400 });
    }

    if (new Date(voteSession.expires_at) < new Date()) {
      await supabaseServer
        .from('aux_vote_sessions')
        .update({ status: 'expired' })
        .eq('id', voteSessionId);
      return Response.json({ error: 'Vote has expired' }, { status: 400 });
    }

    // Check already voted
    const { data: existingVote } = await supabaseServer
      .from('aux_vote_records')
      .select('id')
      .eq('vote_session_id', voteSessionId)
      .eq('guest_id', guestId)
      .single();

    if (existingVote) {
      return Response.json({ error: 'Already voted' }, { status: 400 });
    }

    // Insert vote
    await supabaseServer.from('aux_vote_records').insert({
      vote_session_id: voteSessionId,
      guest_id: guestId,
      vote,
    });

    const newYes = voteSession.yes_votes + (vote ? 1 : 0);
    const newNo = voteSession.no_votes + (vote ? 0 : 1);

    const { data: updatedVote } = await supabaseServer
      .from('aux_vote_sessions')
      .update({ yes_votes: newYes, no_votes: newNo })
      .eq('id', voteSessionId)
      .select()
      .single();

    // Check if passed
    if (newYes >= voteSession.required) {
      await supabaseServer
        .from('aux_vote_sessions')
        .update({ status: 'passed' })
        .eq('id', voteSessionId);

      // Execute action
      if (voteSession.type === 'skip' || voteSession.type === 'challenge') {
        // Find host to get access token
        const { data: host } = await supabaseServer
          .from('aux_hosts')
          .select('*')
          .eq('id', room.host_id)
          .single();

        if (host && room.device_id) {
          try {
            const accessToken = await refreshTokenIfNeeded(host as Host);
            await skipTrack(accessToken, room.device_id);
          } catch {
            // Continue even if skip fails
          }
        }
      }

      if (voteSession.type === 'challenge') {
        // Transfer aux to initiator
        if (voteSession.initiated_by) {
          await supabaseServer
            .from('aux_rooms')
            .update({
              current_aux_holder_id: voteSession.initiated_by,
              aux_songs_remaining: 2,
            })
            .eq('id', room.id);
        }
      }

      return Response.json({ passed: true, voteSession: updatedVote });
    }

    // Check if failed (majority no)
    const { data: guests } = await supabaseServer
      .from('aux_guests')
      .select('id')
      .eq('room_id', room.id);
    const guestCount = guests?.length || 1;
    const majorityNo = Math.ceil(guestCount / 2);

    if (newNo >= majorityNo) {
      await supabaseServer
        .from('aux_vote_sessions')
        .update({ status: 'failed' })
        .eq('id', voteSessionId);
      return Response.json({ passed: false, voteSession: updatedVote });
    }

    return Response.json({ passed: false, voteSession: updatedVote });
  }

  if (action === 'veto') {
    // Host only
    const host = await getHostFromRequest(request);
    if (!host || host.id !== room.host_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}
