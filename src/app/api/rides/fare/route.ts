import { NextResponse } from 'next/server';
import { suggestFare } from '@/lib/fare';
import { kycRequired } from '@/lib/kyc-rules';

/** AI-assisted fare + ETA + KYC preview shown in the Publish Ride flow (PRD §4.1, §10.1). */
export async function POST(req: Request) {
  const { vehicleType, listingType, distanceKm, departAt } = await req.json();
  if (!vehicleType || !distanceKm || !departAt)
    return NextResponse.json({ error: 'vehicleType, distanceKm and departAt are required' }, { status: 400 });
  const when = new Date(departAt);
  const fare = await suggestFare(vehicleType, Number(distanceKm), when);
  const needsKyc = kycRequired({ vehicleType, listingType: listingType ?? 'POOL', distanceKm: Number(distanceKm), departAt: when });
  return NextResponse.json({ ...fare, kycRequired: needsKyc });
}
