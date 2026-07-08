import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';

// Rate limit: 5 registrations / hour per IP
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

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().regex(/^\d{10}$/, 'Enter a 10-digit mobile number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  gender: z.string().optional(),
  asDriver: z.boolean().optional(),
  driverType: z.enum(['NON_COMMERCIAL_DRIVER', 'COMMERCIAL_DRIVER']).optional(),
});

export async function POST(req: Request) {
  try {
    const ip = (await headers()).get('x-forwarded-for') ?? 'unknown';
    if (!checkRateLimit(ip, 5, 60 * 60 * 1000))
      return NextResponse.json({ error: 'Too many registrations from this device. Try again in an hour.' }, { status: 429 });
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 });
    const { name, phone, password, gender, asDriver, driverType } = body.data;
    if (await prisma.user.findUnique({ where: { phone } }))
      return NextResponse.json({ error: 'This mobile number is already registered' }, { status: 409 });
    const roles: string[] = ['RIDER'];
    if (asDriver) roles.push(driverType ?? 'NON_COMMERCIAL_DRIVER');
    const user = await prisma.user.create({
      data: { name, phone, gender, passwordHash: await hashPassword(password), roles: roles as any },
    });
    await createSession(user.id);
    return NextResponse.json({ id: user.id, name: user.name, roles: user.roles });
  } catch (e) {
    console.error('register error', e);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
