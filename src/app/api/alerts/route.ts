import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser, requireRole, AuthError } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { sendSms } from '@/lib/integrations';

/**
 * Safety alerts (PRD §10.2, §11).
 * Driver-first flow for stationary alerts: prompt the DRIVER first (tea break?);
 * only after driver response (or timeout escalation) is the RIDER notified.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const raw = await req.json();
    const { rideId, type, detail, action, alertId } = raw;

    if (typeof action === 'string' && action.toLowerCase().replace('_', '-') === 'confirm-safe') {
      // Driver marks themselves safe → alert then flows to rider (PRD §11)
      const targetId = alertId ?? detail?.alertId;
      if (!targetId) return NextResponse.json({ error: 'alertId is required' }, { status: 400 });
      const alert = await prisma.safetyAlert.update({
        where: { id: targetId },
        data: { status: 'DRIVER_CONFIRMED_SAFE', resolvedAt: new Date() },
        include: { ride: { include: { bookings: { include: { rider: true } } } } },
      });
      for (const b of alert.ride.bookings)
        await sendSms(b.rider.phone, 'Sahyatri: brief stop on your ride — the driver has confirmed all is well.');
      await audit('Stationary alert: driver confirmed safe', { actorId: user.id, entity: 'SafetyAlert', entityId: alert.id });
      return NextResponse.json(alert);
    }

    const ride = await prisma.ride.findUnique({ where: { id: rideId }, include: { driver: true } });
    if (!ride) return NextResponse.json({ error: 'Ride not found' }, { status: 404 });

    const alert = await prisma.safetyAlert.create({ data: { rideId, type, detail } });
    await audit(`Safety alert: ${type}`, { entity: 'SafetyAlert', entityId: alert.id, detail: { rideId } });

    if (type === 'STATIONARY_VEHICLE') {
      await sendSms(ride.driver.phone, 'Sahyatri safety check: your vehicle has been stationary 5+ minutes. Tea break? Open the app to confirm you are safe.');
    } else if (type === 'ROUTE_DEVIATION' || type === 'ETA_BREACH' || type === 'TRIP_NOT_STARTED') {
      const bookings = await prisma.booking.findMany({ where: { rideId }, include: { rider: true } });
      for (const b of bookings) await sendSms(b.rider.phone, `Sahyatri alert on your ride: ${type.replaceAll('_', ' ').toLowerCase()}.`);
    } else if (type === 'SPEEDING_HARSH_DRIVING') {
      await prisma.user.update({ where: { id: ride.driverId }, data: { safetyScore: { decrement: 5 } } });
    } else if (type === 'SOS') {
      alert; // surfaced on the live support dashboard below
    }
    return NextResponse.json(alert, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

/** Live active-trip alert dashboard for Super Admin & Customer Support (PRD §10.2). */
export async function GET() {
  try {
    await requireRole('SUPER_ADMIN', 'CUSTOMER_SUPPORT');
    const alerts = await prisma.safetyAlert.findMany({
      where: { status: { in: ['OPEN', 'ESCALATED'] } },
      include: { ride: { select: { origin: true, destination: true, driver: { select: { name: true, phone: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json(alerts);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
