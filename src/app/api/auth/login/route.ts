import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyPassword, createSession } from '@/lib/auth';

// Simple in-process rate limiter — 10 attempts / 15 min per IP.
// Replace with Upstash Redis for multi-instance deployments.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= max;
}

export async function POST(req: Request) {
  try {
    const ip = (await headers()).get('x-forwarded-for') ?? 'unknown';
    if (!checkRateLimit(ip, 10, 15 * 60 * 1000))
      return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
    const { phone, password } = await req.json();
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || !(await verifyPassword(password, user.passwordHash)))
      return NextResponse.json({ error: 'Mobile number or password is incorrect' }, { status: 401 });
    if (user.isSuspended)
      return NextResponse.json({ error: 'This account is suspended. Contact support.' }, { status: 403 });
    await createSession(user.id);
    return NextResponse.json({ id: user.id, name: user.name, roles: user.roles });
  } catch (e) {
    console.error('login error', e);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
