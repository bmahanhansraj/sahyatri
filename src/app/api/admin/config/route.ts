import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole, AuthError } from '@/lib/auth';
import { audit } from '@/lib/audit';

/** Super Admin platform configuration: quotas, fares, booking fees, alert thresholds (PRD §12.2). */
export async function GET() {
  try {
    await requireRole('SUPER_ADMIN');
    const rows = await prisma.platformConfig.findMany();
    return NextResponse.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole('SUPER_ADMIN');
    const schema = z.object({ key: z.string(), value: z.unknown() });
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { key, value } = parsed.data as { key: string; value: any };
    const allowed = ['quota.weekly', 'fare.perKm', 'fee.booking', 'alerts.thresholds'];
    if (!allowed.includes(key))
      return NextResponse.json({ error: `Unknown setting. Allowed: ${allowed.join(', ')}` }, { status: 400 });
    const row = await prisma.platformConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    await audit('Platform config updated', { actorId: admin.id, entity: 'PlatformConfig', entityId: key, detail: { value } });
    return NextResponse.json(row);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
