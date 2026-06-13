import { supabaseServer } from './supabase-server';
import type { Host, SpotifyDevice, SpotifyPlayback, SpotifyTrack } from './types';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

export async function refreshTokenIfNeeded(host: Host): Promise<string> {
  const expiresAt = new Date(host.token_expires_at).getTime();
  const now = Date.now();
  const bufferMs = 60 * 1000; // 60 seconds

  if (now + bufferMs < expiresAt) {
    return host.access_token;
  }

  // Need to refresh
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: host.refresh_token,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to refresh token: ${res.statusText}`);
  }

  const data = await res.json();
  const newAccessToken = data.access_token;
  const newRefreshToken = data.refresh_token || host.refresh_token;
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  await supabaseServer
    .from('aux_hosts')
    .update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_expires_at: newExpiresAt,
    })
    .eq('id', host.id);

  return newAccessToken;
}

export async function getMe(accessToken: string) {
  const res = await fetch(`${SPOTIFY_API}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`getMe failed: ${res.statusText}`);
  return res.json();
}

export async function getDevices(accessToken: string): Promise<SpotifyDevice[]> {
  const res = await fetch(`${SPOTIFY_API}/me/player/devices`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`getDevices failed: ${res.statusText}`);
  const data = await res.json();
  return data.devices || [];
}

export async function getCurrentPlayback(accessToken: string): Promise<SpotifyPlayback | null> {
  const res = await fetch(`${SPOTIFY_API}/me/player?additional_types=track`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 204 || !res.ok) return null;
  return res.json();
}

export async function playTrack(
  accessToken: string,
  deviceId: string,
  trackUri: string
): Promise<void> {
  const res = await fetch(`${SPOTIFY_API}/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris: [trackUri] }),
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`playTrack failed: ${res.status} ${text}`);
  }
}

export async function pausePlayback(accessToken: string, deviceId: string): Promise<void> {
  const res = await fetch(`${SPOTIFY_API}/me/player/pause?device_id=${deviceId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`pausePlayback failed: ${res.statusText}`);
  }
}

export async function skipTrack(accessToken: string, deviceId: string): Promise<void> {
  const res = await fetch(`${SPOTIFY_API}/me/player/next?device_id=${deviceId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`skipTrack failed: ${res.statusText}`);
  }
}

export async function search(accessToken: string, query: string): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({
    q: query,
    type: 'track',
    limit: '10',
  });
  const res = await fetch(`${SPOTIFY_API}/search?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`search failed: ${res.statusText}`);
  const data = await res.json();
  return data.tracks?.items || [];
}

export async function getRecommendations(
  accessToken: string,
  seedUris: string[]
): Promise<SpotifyTrack[]> {
  // Extract track IDs from URIs
  const seedTrackIds = seedUris
    .slice(0, 5)
    .map(uri => uri.split(':')[2])
    .filter(Boolean)
    .join(',');

  if (!seedTrackIds) return [];

  const params = new URLSearchParams({
    seed_tracks: seedTrackIds,
    limit: '5',
  });

  const res = await fetch(`${SPOTIFY_API}/recommendations?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.tracks || [];
}

export async function transferPlayback(accessToken: string, deviceId: string): Promise<void> {
  const res = await fetch(`${SPOTIFY_API}/me/player`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ device_ids: [deviceId], play: true }),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`transferPlayback failed: ${res.statusText}`);
  }
}
