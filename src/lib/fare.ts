/**
 * Fare engine — PRD §9 (distance/time pricing, peak/night surge) and
 * §14 (booking fee configurable by Super Admin per ride type, +18% GST on fee).
 */
import { prisma } from './db';
import { isNightRide } from './kyc-rules';

export const GST_RATE = 0.18;

// Base per-km rates (₹). Super Admin–overridable via PlatformConfig "fare.perKm".
const DEFAULT_PER_KM = { BIKE: 4, CAR: 9, BUS: 3 } as const;
const NIGHT_SURGE_MULTIPLIER = 1.25;

// Default booking fees per listing type (₹). Overridable via "fee.booking".
const DEFAULT_BOOKING_FEE = { POOL: 10, ONE_WAY: 25, BUS: 15 } as const;

// Drivers can edit the suggested fare within these platform-defined bounds (PRD §4.1)
export const FARE_BOUNDS = { minFactor: 0.7, maxFactor: 1.5 };

async function configOr<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.platformConfig.findUnique({ where: { key } });
  return row ? ({ ...fallback, ...(row.value as object) } as T) : fallback;
}

export async function suggestFare(
  vehicleType: 'BIKE' | 'CAR' | 'BUS',
  distanceKm: number,
  departAt: Date
): Promise<{ suggested: number; min: number; max: number; surged: boolean }> {
  const perKm = await configOr('fare.perKm', { ...DEFAULT_PER_KM });
  let fare = distanceKm * perKm[vehicleType];
  const surged = isNightRide(departAt);
  if (surged) fare *= NIGHT_SURGE_MULTIPLIER;
  fare = Math.max(10, Math.round(fare));
  return {
    suggested: fare,
    min: Math.round(fare * FARE_BOUNDS.minFactor),
    max: Math.round(fare * FARE_BOUNDS.maxFactor),
    surged,
  };
}

/** Booking fee applies to ALL ride types; 18% GST on the fee (PRD §14). */
export async function bookingCharges(
  listingType: 'POOL' | 'ONE_WAY' | 'BUS',
  farePerSeat: number,
  seats: number
): Promise<{ fareTotal: number; bookingFee: number; gstOnFee: number; payable: number }> {
  const fees = await configOr('fee.booking', { ...DEFAULT_BOOKING_FEE });
  const bookingFee = fees[listingType] * seats;
  const gstOnFee = Math.round(bookingFee * GST_RATE * 100) / 100;
  const fareTotal = farePerSeat * seats;
  return { fareTotal, bookingFee, gstOnFee, payable: fareTotal + bookingFee + gstOnFee };
}

/** Straight-line distance + 25% road factor. Swap for a maps API in production. */
export function estimateDistanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const straight = 2 * R * Math.asin(Math.sqrt(h));
  return Math.round(straight * 1.25 * 10) / 10;
}

/** Simple ETA model (avg speeds) — replace with live-traffic AI service (PRD §10.1). */
export function estimateEtaMinutes(vehicleType: 'BIKE' | 'CAR' | 'BUS', distanceKm: number): number {
  const avgKmph = { BIKE: 28, CAR: 35, BUS: 30 }[vehicleType];
  return Math.max(5, Math.round((distanceKm / avgKmph) * 60));
}
