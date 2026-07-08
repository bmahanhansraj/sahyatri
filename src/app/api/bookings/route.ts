import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { riderClearsKycGate } from '@/lib/kyc-rules';
import { bookingCharges } from '@/lib/fare';
import { audit } from '@/lib/audit';
import { sendSms, createRazorpayOrder } from '@/lib/integrations';

const schema = z.object({
  rideId: z.string(),
  seats: z.number().int().min(1).default(1),
  seatNumbers: z.array(z.string()).optional(), // bus seat-map selections (PRD §9)
  paymentMethod: z.enum(['CASH', 'WALLET', 'UPI', 'CARD']).default('CASH'),
});

/** Book a ride (PRD §9) with the KYC gate + corporate pre-verification bypass (PRD §5.1). */
export async function POST(req: Request) {
  try {
    const rider = await requireUser();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { rideId, seats, seatNumbers, paymentMethod } = parsed.data;

    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.status !== 'PUBLISHED')
      return NextResponse.json({ error: 'This ride is no longer available' }, { status: 404 });
    if (ride.driverId === rider.id)
      return NextResponse.json({ error: 'You cannot book your own ride' }, { status: 400 });
    if (ride.womenOnly && rider.gender !== 'female')
      return NextResponse.json({ error: 'This is a women-only pool' }, { status: 403 });
    if (ride.seatsBooked + seats > ride.seatsTotal)
      return NextResponse.json({ error: `Only ${ride.seatsTotal - ride.seatsBooked} seat(s) left` }, { status: 409 });

    // KYC gate (PRD §6) with platform-wide corporate pre-verification bypass (PRD §5.1)
    const gate = riderClearsKycGate(rider.kycStatus, ride.kycRequired);
    if (!gate.allowed)
      return NextResponse.json(
        { error: 'This ride requires KYC verification. Complete KYC from your profile to book.', kycGate: true },
        { status: 403 }
      );

    const charges = await bookingCharges(ride.listingType, ride.farePerSeat, seats);

    // Cash allowed only where riders pay drivers directly: Car Pool & One-Way (PRD §14)
    if (paymentMethod === 'CASH' && ride.listingType === 'BUS')
      return NextResponse.json({ error: 'Bus tickets are paid online (wallet, UPI or card)' }, { status: 400 });

    let gatewayRef: string | undefined;
    if (paymentMethod !== 'CASH') {
      const order = await createRazorpayOrder(Math.round(charges.payable * 100), `ride_${rideId}`);
      gatewayRef = order.orderId;
    }

    const booking = await prisma.$transaction(async (tx) => {
      // Re-check seats inside the transaction to prevent overbooking under load
      const fresh = await tx.ride.findUniqueOrThrow({ where: { id: rideId } });
      if (fresh.seatsBooked + seats > fresh.seatsTotal) throw new Error('SOLD_OUT');

      const b = await tx.booking.create({
        data: {
          rideId,
          riderId: rider.id,
          seats,
          seatNumbers: seatNumbers as any,
          fareTotal: charges.fareTotal,
          bookingFee: charges.bookingFee,
          gstOnFee: charges.gstOnFee,
          paymentMethod,
          kycBypassLogged: gate.viaCorporateBypass,
          qrCode: ride.listingType === 'BUS' ? `SAHYATRI-${rideId.slice(-6)}-${Date.now().toString(36)}` : null,
        },
      });
      const updated = await tx.ride.update({
        where: { id: rideId },
        data: { seatsBooked: { increment: seats } },
      });
      if (updated.seatsBooked >= updated.seatsTotal)
        await tx.ride.update({ where: { id: rideId }, data: { status: 'FULL' } });
      if (paymentMethod === 'WALLET' || gatewayRef)
        await tx.walletTransaction.create({
          data: {
            userId: rider.id,
            amount: -charges.payable,
            reason: `Booking ${b.id}`,
            bookingId: b.id,
            gatewayRef,
          },
        });
      return b;
    });

    // Every corporate bypass is logged for traceability and compliance (PRD §5.1)
    if (gate.viaCorporateBypass)
      await audit('KYC bypass: Corporate pre-verification', {
        actorId: rider.id,
        entity: 'Booking',
        entityId: booking.id,
      });

    await sendSms(rider.phone, `Sahyatri: booking confirmed — ${ride.origin} → ${ride.destination}. Total ₹${charges.payable}.`);
    return NextResponse.json({ ...booking, charges }, { status: 201 });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e?.message === 'SOLD_OUT')
      return NextResponse.json({ error: 'Those seats were just taken. Pick another ride.' }, { status: 409 });
    throw e;
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    const bookings = await prisma.booking.findMany({
      where: { riderId: user.id },
      include: { ride: { include: { driver: { select: { name: true, kycStatus: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(bookings);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
