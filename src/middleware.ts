import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Security headers applied to every response (works in standalone, Docker, App Runner, Vercel).
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
};

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  return res;
}

export const config = { matcher: '/((?!_next/static|_next/image|favicon).*)' };
