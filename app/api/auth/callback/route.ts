import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabase-server';
import { signHostToken } from '@/lib/auth';
import { getMe } from '@/lib/spotify';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return Response.redirect(new URL('/?error=auth_denied', request.url));
  }

  // Exchange code for tokens
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    }),
  });

  if (!tokenRes.ok) {
    return Response.redirect(new URL('/?error=token_exchange_failed', request.url));
  }

  const tokenData = await tokenRes.json();
  const { access_token, refresh_token, expires_in } = tokenData;
  const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  // Get Spotify user profile
  let spotifyUser;
  try {
    spotifyUser = await getMe(access_token);
  } catch {
    return Response.redirect(new URL('/?error=profile_fetch_failed', request.url));
  }

  // Upsert host in DB
  const { data: host, error: dbError } = await supabaseServer
    .from('aux_hosts')
    .upsert(
      {
        spotify_id: spotifyUser.id,
        display_name: spotifyUser.display_name || spotifyUser.id,
        avatar_url: spotifyUser.images?.[0]?.url || null,
        access_token,
        refresh_token,
        token_expires_at: tokenExpiresAt,
      },
      { onConflict: 'spotify_id' }
    )
    .select()
    .single();

  if (dbError || !host) {
    return Response.redirect(new URL('/?error=db_error', request.url));
  }

  // Sign JWT
  const jwt = await signHostToken(host.id);

  // Set httpOnly cookie
  const cookieStore = await cookies();
  cookieStore.set('aux_host_token', jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  return Response.redirect(new URL('/host/setup', request.url));
}
