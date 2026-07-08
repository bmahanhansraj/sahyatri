/**
 * KYC rules engine — PRD §6.
 *
 * | Vehicle | Ride Type | Condition                                   | KYC?         |
 * | Bike    | Pool      | any                                         | Never        |
 * | Car     | Pool      | local, daytime                              | No           |
 * | Car     | Pool      | outstation (>5 km) or 6 PM–5 AM             | Yes          |
 * | Car     | One-Way   | always                                      | Yes          |
 * | Bus     | any       | per fleet/corporate policy (PRD §15)        | Configurable |
 */

export const OUTSTATION_THRESHOLD_KM = 5;
export const NIGHT_START_HOUR = 18; // 6 PM
export const NIGHT_END_HOUR = 5; // 5 AM

export interface KycContext {
  vehicleType: 'BIKE' | 'CAR' | 'BUS';
  listingType: 'POOL' | 'ONE_WAY' | 'BUS';
  distanceKm: number;
  departAt: Date;
  /** Corporate bus policy override (PRD §15): default false — bus bookings need no KYC */
  corporateBusKycRequired?: boolean;
}

export function isNightRide(departAt: Date): boolean {
  const h = departAt.getHours();
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
}

export function isOutstation(distanceKm: number): boolean {
  return distanceKm > OUTSTATION_THRESHOLD_KM;
}

/** Returns whether this ride requires rider/driver KYC. */
export function kycRequired(ctx: KycContext): boolean {
  // Bike Pool: fully exempt under all conditions
  if (ctx.vehicleType === 'BIKE') return false;

  if (ctx.listingType === 'ONE_WAY') return true; // Car One-Way: always

  if (ctx.vehicleType === 'CAR' && ctx.listingType === 'POOL') {
    return isOutstation(ctx.distanceKm) || isNightRide(ctx.departAt);
  }

  if (ctx.vehicleType === 'BUS') {
    // Default: no KYC for bus bookings; corporates may require it by policy
    return ctx.corporateBusKycRequired ?? false;
  }

  return false;
}

/**
 * Whether a rider clears the KYC gate for a ride.
 * PRE_VERIFIED (Corporate Riders, PRD §5.1) bypasses platform-wide —
 * caller must write the audit log "KYC bypass: Corporate pre-verification".
 */
export function riderClearsKycGate(
  riderKycStatus: string,
  rideNeedsKyc: boolean
): { allowed: boolean; viaCorporateBypass: boolean } {
  if (!rideNeedsKyc) return { allowed: true, viaCorporateBypass: false };
  if (riderKycStatus === 'APPROVED') return { allowed: true, viaCorporateBypass: false };
  if (riderKycStatus === 'PRE_VERIFIED') return { allowed: true, viaCorporateBypass: true };
  return { allowed: false, viaCorporateBypass: false };
}
