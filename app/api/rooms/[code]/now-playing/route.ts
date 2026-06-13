import { supabaseServer } from '@/lib/supabase-server';
import { getHostFromRequest } from '@/lib/auth';
import {
  refreshTokenIfNeeded,
  getCurrentPlayback,
  playTrack,
  getRecommendations,
} from '@/lib/spotify';
import type { Host } from '@/lib/types';

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

  if (room.status !== 'active') {
    return Response.json({ error: 'Room is not active' }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await refreshTokenIfNeeded(host as Host);
  } catch {
    return Response.json({ error: 'Failed to refresh Spotify token' }, { status: 500 });
  }

  // Get current playback from Spotify
  const playback = await getCurrentPlayback(accessToken);

  if (!playback || !playback.item) {
    // Nothing playing - check queue
    const { data: nextItems } = await supabaseServer
      .from('aux_queue')
      .select('*')
      .eq('room_id', room.id)
      .eq('status', 'queued')
      .order('position', { ascending: true })
      .limit(1);

    const nextItem = nextItems?.[0];
    if (nextItem && room.device_id) {
      try {
        await playTrack(accessToken, room.device_id, nextItem.track_uri);
        await supabaseServer
          .from('aux_queue')
          .update({ status: 'playing' })
          .eq('id', nextItem.id);

        await supabaseServer
          .from('aux_rooms')
          .update({
            current_track: {
              uri: nextItem.track_uri,
              name: nextItem.track_name,
              artist: nextItem.track_artist,
              image: nextItem.track_image,
            },
            is_playing: true,
            current_aux_holder_id: nextItem.suggested_by || room.current_aux_holder_id,
          })
          .eq('id', room.id);
      } catch {
        // Ignore play errors
      }
    }

    const { data: queueCount } = await supabaseServer
      .from('aux_queue')
      .select('id')
      .eq('room_id', room.id)
      .eq('status', 'queued');

    return Response.json({
      track: null,
      isPlaying: false,
      queueLength: queueCount?.length || 0,
    });
  }

  const currentSpotifyTrack = playback.item;
  const prevTrack = room.current_track as { uri?: string } | null;
  const trackChanged = prevTrack?.uri !== currentSpotifyTrack.uri;

  if (trackChanged && prevTrack?.uri) {
    // Log old track to aux_played with reaction counts
    const { data: existingReactions } = await supabaseServer
      .from('aux_reactions')
      .select('type')
      .eq('room_id', room.id)
      .eq('track_uri', prevTrack.uri);

    const fireCount = existingReactions?.filter(r => r.type === 'fire').length || 0;
    const skullCount = existingReactions?.filter(r => r.type === 'skull').length || 0;
    const danceCount = existingReactions?.filter(r => r.type === 'dance').length || 0;

    // Find who suggested this track
    const { data: prevQueueItem } = await supabaseServer
      .from('aux_queue')
      .select('*')
      .eq('room_id', room.id)
      .eq('track_uri', prevTrack.uri)
      .order('added_at', { ascending: false })
      .limit(1)
      .single();

    // Check if already logged
    const { data: alreadyPlayed } = await supabaseServer
      .from('aux_played')
      .select('id')
      .eq('room_id', room.id)
      .eq('track_uri', prevTrack.uri)
      .order('played_at', { ascending: false })
      .limit(1)
      .single();

    if (!alreadyPlayed) {
      await supabaseServer.from('aux_played').insert({
        room_id: room.id,
        track_uri: prevTrack.uri,
        track_name: (prevTrack as { name?: string }).name || null,
        track_artist: (prevTrack as { artist?: string }).artist || null,
        track_image: (prevTrack as { image?: string }).image || null,
        played_by: prevQueueItem?.suggested_by || room.current_aux_holder_id,
        played_by_name: prevQueueItem?.suggested_by_name || null,
        fire_count: fireCount,
        skull_count: skullCount,
        dance_count: danceCount,
      });
    }

    // Decrement aux_songs_remaining
    let newAuxSongsRemaining = (room.aux_songs_remaining || 2) - 1;
    let newAuxHolderId = room.current_aux_holder_id;

    if (newAuxSongsRemaining <= 0) {
      newAuxSongsRemaining = 2;
      // Find next person with queued song
      const { data: nextQueued } = await supabaseServer
        .from('aux_queue')
        .select('*')
        .eq('room_id', room.id)
        .eq('status', 'queued')
        .not('suggested_by', 'is', null)
        .order('position', { ascending: true })
        .limit(1);

      if (nextQueued?.[0]?.suggested_by) {
        newAuxHolderId = nextQueued[0].suggested_by;
      }
    }

    // Mark old queue item as played
    if (prevQueueItem) {
      await supabaseServer
        .from('aux_queue')
        .update({ status: 'played' })
        .eq('id', prevQueueItem.id);
    }

    // Pop next track from queue
    const { data: nextItems } = await supabaseServer
      .from('aux_queue')
      .select('*')
      .eq('room_id', room.id)
      .eq('status', 'queued')
      .order('position', { ascending: true })
      .limit(1);

    const nextItem = nextItems?.[0];

    if (nextItem && room.device_id) {
      try {
        await playTrack(accessToken, room.device_id, nextItem.track_uri);
        await supabaseServer
          .from('aux_queue')
          .update({ status: 'playing' })
          .eq('id', nextItem.id);
      } catch {
        // Ignore
      }
    }

    // Update room
    await supabaseServer
      .from('aux_rooms')
      .update({
        current_track: {
          uri: currentSpotifyTrack.uri,
          id: currentSpotifyTrack.id,
          name: currentSpotifyTrack.name,
          artist: currentSpotifyTrack.artists?.[0]?.name || 'Unknown',
          image: currentSpotifyTrack.album?.images?.[0]?.url || null,
          duration_ms: currentSpotifyTrack.duration_ms,
        },
        is_playing: playback.is_playing,
        current_aux_holder_id: newAuxHolderId,
        aux_songs_remaining: newAuxSongsRemaining,
      })
      .eq('id', room.id);

    // Check queue size for recommendations
    const { data: queueItems } = await supabaseServer
      .from('aux_queue')
      .select('track_uri')
      .eq('room_id', room.id)
      .eq('status', 'queued');

    if ((queueItems?.length || 0) < 3) {
      // Get recent played uris for seed
      const { data: recentPlayed } = await supabaseServer
        .from('aux_played')
        .select('track_uri')
        .eq('room_id', room.id)
        .order('played_at', { ascending: false })
        .limit(5);

      const seedUris = recentPlayed?.map(p => p.track_uri) || [];
      if (seedUris.length > 0) {
        try {
          const recommendations = await getRecommendations(accessToken, seedUris);
          const lastPos = queueItems?.length || 0;

          for (let i = 0; i < recommendations.length; i++) {
            const rec = recommendations[i];
            // Check not already in queue
            const { data: dupe } = await supabaseServer
              .from('aux_queue')
              .select('id')
              .eq('room_id', room.id)
              .eq('track_uri', rec.uri)
              .eq('status', 'queued')
              .single();

            if (!dupe) {
              await supabaseServer.from('aux_queue').insert({
                room_id: room.id,
                track_uri: rec.uri,
                track_name: rec.name,
                track_artist: rec.artists?.[0]?.name || 'Unknown',
                track_image: rec.album?.images?.[0]?.url || null,
                track_duration_ms: rec.duration_ms || null,
                suggested_by: null,
                suggested_by_name: 'Aux AI',
                position: lastPos + i,
                status: 'queued',
              });
            }
          }
        } catch {
          // Ignore recommendation errors
        }
      }
    }
  } else {
    // Same track, just update playback state
    await supabaseServer
      .from('aux_rooms')
      .update({
        current_track: {
          uri: currentSpotifyTrack.uri,
          id: currentSpotifyTrack.id,
          name: currentSpotifyTrack.name,
          artist: currentSpotifyTrack.artists?.[0]?.name || 'Unknown',
          image: currentSpotifyTrack.album?.images?.[0]?.url || null,
          duration_ms: currentSpotifyTrack.duration_ms,
        },
        is_playing: playback.is_playing,
      })
      .eq('id', room.id);
  }

  const { data: queueCount } = await supabaseServer
    .from('aux_queue')
    .select('id')
    .eq('room_id', room.id)
    .eq('status', 'queued');

  return Response.json({
    track: {
      uri: currentSpotifyTrack.uri,
      id: currentSpotifyTrack.id,
      name: currentSpotifyTrack.name,
      artist: currentSpotifyTrack.artists?.[0]?.name || 'Unknown',
      image: currentSpotifyTrack.album?.images?.[0]?.url || null,
      duration_ms: currentSpotifyTrack.duration_ms,
    },
    isPlaying: playback.is_playing,
    queueLength: queueCount?.length || 0,
  });
}
