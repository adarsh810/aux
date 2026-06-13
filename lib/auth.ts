import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { supabaseServer } from './supabase-server';
import type { Host } from './types';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'aux-dev-secret-change-in-production');
const COOKIE_NAME = 'aux_host_token';

export async function signHostToken(hostId: string): Promise<string> {
  return new SignJWT({ hostId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
}

export async function verifyHostToken(token: string): Promise<{ hostId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (typeof payload.hostId === 'string') {
      return { hostId: payload.hostId };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getHostFromRequest(request: Request): Promise<Host | null> {
  // Try cookie from request headers first
  const cookieHeader = request.headers.get('cookie');
  let token: string | null = null;

  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      const [name, ...valueParts] = cookie.split('=');
      if (name.trim() === COOKIE_NAME) {
        token = valueParts.join('=');
        break;
      }
    }
  }

  if (!token) return null;

  const payload = await verifyHostToken(token);
  if (!payload) return null;

  const { data: host, error } = await supabaseServer
    .from('aux_hosts')
    .select('*')
    .eq('id', payload.hostId)
    .single();

  if (error || !host) return null;
  return host as Host;
}

export async function getHostFromCookies(): Promise<Host | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyHostToken(token);
  if (!payload) return null;

  const { data: host, error } = await supabaseServer
    .from('aux_hosts')
    .select('*')
    .eq('id', payload.hostId)
    .single();

  if (error || !host) return null;
  return host as Host;
}
