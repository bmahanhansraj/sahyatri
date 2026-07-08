/**
 * Session auth: signed JWT in an httpOnly cookie.
 * Phone + password for MVP; OTP login via 2Factor.in is stubbed in integrations.ts.
 */
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret-change-me');
const COOKIE = 'sahyatri_session';

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.isSuspended) return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AuthError('Not signed in');
  return user;
}

export async function requireRole(...roles: string[]) {
  const user = await requireUser();
  if (!user.roles.some((r) => roles.includes(r))) throw new AuthError('Not permitted');
  return user;
}

export class AuthError extends Error {}
