import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { checkAdhocQuota } from '@/lib/quota';
import { kycRequired, isOutstation } from '@/lib/kyc-rules';
import { suggestFare, estimateEtaMinutes, FARE_BOUNDS } from '@/lib/fare';
import { audit } from '@/lib/audit';
import { sendSms } from '@/lib/integrations';

const publishSchema = z.object({
  listingType: z.enum(['POOL', 'ONE_WAY', 'BUS']),
  vehicleType: z.enum(['BIKE', 'CAR', 'BUS']),
  scheduleType: z.enum(['ONE_TIME', 'RECURRING']).default('ONE_TIME'),
  origin: z.string().min(2),
  destination: z.string().min(2),
  distanceKm: z.number().positive(),
  departAt: z.string().datetime(),
  seatsTotal: z.number().int().min(1).max(60),
  farePerSeat: z.number().positive(),
  womenOnly: z.boolean().default(false),
  vehicleId: z.string().optional(),
  asDraft: z.boolean().default(false),
  clonedFromId: z.string().optional(), // duplicate/repeat publish (PRD §4.2)
});

/** Publish Ride (PRD §4) — the core flow for all three listing types. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = publishSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const d = parsed.data;

    const isDriver = user.roles.some((r) =>
      ['NON_COMMERCIAL_DRIVER', 'COMMERCIAL_DRIVER', 'FLEET_OPERATOR'].includes(r)
    );
    if (!isDriver)
      return NextResponse.json(
        { error: 'Switch to driver mode to publish a ride. Add a driver role from your profile.' },
        { status: 403 }
      );

    // Listing-type constraints (PRD §3): One-Way is car only; Bus listings are bus vehicles.
    if (d.listingType === 'ONE_WAY' && d.vehicleType !== 'CAR')
      return NextResponse.json({ error: 'One-Way rides are car only' }, { status: 400 });
    if ((d.listingType === 'BUS') !== (d.vehicleType === 'BUS'))
      return NextResponse.json({ error: 'Bus listings must use a bus vehicle' }, { status: 400 });
    if (d.listingType === 'BUS' && !user.roles.includes('FLEET_OPERATOR'))
      return NextResponse.json({ error: 'Bus routes are published by fleet operators' }, { status: 400 });

    const departAt = new Date(d.departAt);

    // Quota/eligibility check (PRD §4.1): weekly ad-hoc cap for non-commercial drivers.
    // Commercial and fleet-tagged commercial vehicles bypass (PRD §4.2, §5.2).
    if (!d.asDraft && d.scheduleType === 'ONE_TIME') {
      const quota = await checkAdhocQuota(user.id, user.roles, d.vehicleType);
      if (quota.applies && !quota.allowed) {
        return NextResponse.json(
          {
            error: `Weekly ad-hoc limit reached (${quota.used}/${quota.limit} ${d.vehicleType.toLowerCase()} routes this week). Your quota resets on a rolling 7-day basis.`,
            quota,
          },
          { status: 429 }
        );
      }
    }

    // Fare must stay within platform-defined bounds around the suggestion (PRD §4.1)
    const fare = await suggestFare(d.vehicleType, d.distanceKm, departAt);
    if (d.farePerSeat < fare.min || d.farePerSeat > fare.max)
      return NextResponse.json(
        { error: `Fare must be between ₹${fare.min} and ₹${fare.max} for this route`, fare },
        { status: 400 }
      );

    // Resolve whether this ride will require rider KYC (PRD §6)
    const needsKyc = kycRequired({
      vehicleType: d.vehicleType,
      listingType: d.listingType,
      distanceKm: d.distanceKm,
      departAt,
    });

    // Driver-side KYC gate: if the ride requires KYC, the driver must be verified too
    if (!d.asDraft && needsKyc && !['APPROVED', 'PRE_VERIFIED'].includes(user.kycStatus)) {
      return NextResponse.json(
        { error: 'This ride type requires KYC. Complete verification before publishing.', kycGate: true },
        { status: 403 }
      );
    }

    const ride = await prisma.ride.create({
      data: {
        listingType: d.listingType,
        vehicleType: d.vehicleType,
        scheduleType: d.scheduleType,
        status: d.asDraft ? 'DRAFT' : 'PUBLISHED',
        driverId: user.id,
        vehicleId: d.vehicleId,
        origin: d.origin,
        destination: d.destination,
        distanceKm: d.distanceKm,
        departAt,
        etaMinutes: estimateEtaMinutes(d.vehicleType, d.distanceKm),
        seatsTotal: d.seatsTotal,
        farePerSeat: d.farePerSeat,
        womenOnly: d.womenOnly,
        kycRequired: needsKyc,
        isOutstation: isOutstation(d.distanceKm),
        clonedFromId: d.clonedFromId,
      },
    });

    if (!d.asDraft) {
      await audit('Ride published', { actorId: user.id, entity: 'Ride', entityId: ride.id });
      // Quota usage alert (PRD §13): "2 of 3 ad-hoc car routes used this week"
      if (d.scheduleType === 'ONE_TIME') {
        const q = await checkAdhocQuota(user.id, user.roles, d.vehicleType);
        if (q.applies)
          await sendSms(
            user.phone,
            `Sahyatri: ride published. ${q.used} of ${q.limit} ad-hoc ${d.vehicleType.toLowerCase()} routes used this week.`
          );
      }
    }

    return NextResponse.json(ride, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

/** Search & filter listings (PRD §9). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const listingType = searchParams.get('type');
  const q = searchParams.get('q');
  const womenOnly = searchParams.get('womenOnly');
  const maxPrice = searchParams.get('maxPrice');

  const rides = await prisma.ride.findMany({
    where: {
      status: 'PUBLISHED',
      departAt: { gte: new Date() },
      ...(listingType ? { listingType: listingType as any } : {}),
      ...(womenOnly === '1' ? { womenOnly: true } : {}),
      ...(maxPrice ? { farePerSeat: { lte: Number(maxPrice) } } : {}),
      ...(q
        ? {
            OR: [
              { origin: { contains: q, mode: 'insensitive' } },
              { destination: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { driver: { select: { name: true, kycStatus: true, safetyScore: true } } },
    orderBy: { departAt: 'asc' },
    take: 50,
  });
  return NextResponse.json(rides);
}
