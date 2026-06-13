import { NextRequest } from 'next/server';

export async function GET(_request: NextRequest) {
  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'user-read-email',
    'user-read-private',
    'streaming',
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: scopes,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    show_dialog: 'false',
  });

  const url = `https://accounts.spotify.com/authorize?${params}`;
  return Response.redirect(url);
}
