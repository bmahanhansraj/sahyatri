/**
 * Weekly ad-hoc route quota — PRD §4.2 / §5.1.
 *
 * Non-commercial drivers: fixed daily commute (RECURRING) is uncapped;
 * ad-hoc (ONE_TIME) routes are capped per rolling week:
 *   Car: 3 / week   Bike: 6 / week
 * Commercial drivers (independent or fleet-tagged): no cap.
 *
 * Caps are Super Admin–configurable via PlatformConfig key "quota.weekly".
 */
import { prisma } from './db';

export const DEFAULT_WEEKLY_QUOTA = { CAR: 3, BIKE: 6 } as const;

export async function getWeeklyQuotaConfig(): Promise<{ CAR: number; BIKE: number }> {
  const row = await prisma.platformConfig.findUnique({ where: { key: 'quota.weekly' } });
  if (row && typeof row.value === 'object' && row.value !== null) {
    const v = row.value as Record<string, number>;
    return { CAR: v.CAR ?? DEFAULT_WEEKLY_QUOTA.CAR, BIKE: v.BIKE ?? DEFAULT_WEEKLY_QUOTA.BIKE };
  }
  return { ...DEFAULT_WEEKLY_QUOTA };
}

export interface QuotaCheck {
  applies: boolean; // false for commercial drivers and buses
  limit: number;
  used: number;
  remaining: number;
  allowed: boolean;
}

/**
 * Rolling 7-day window (resets automatically — no cron needed).
 * Counts ONE_TIME rides created in the last 7 days that weren't cancelled drafts.
 */
export async function checkAdhocQuota(
  driverId: string,
  driverRoles: string[],
  vehicleType: 'BIKE' | 'CAR' | 'BUS'
): Promise<QuotaCheck> {
  const isCommercial =
    driverRoles.includes('COMMERCIAL_DRIVER') || driverRoles.includes('FLEET_OPERATOR');

  if (isCommercial || vehicleType === 'BUS') {
    return { applies: false, limit: Infinity, used: 0, remaining: Infinity, allowed: true };
  }

  const quotas = await getWeeklyQuotaConfig();
  const limit = vehicleType === 'CAR' ? quotas.CAR : quotas.BIKE;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const used = await prisma.ride.count({
    where: {
      driverId,
      scheduleType: 'ONE_TIME',
      vehicleType,
      createdAt: { gte: weekAgo },
      status: { notIn: ['DRAFT', 'CANCELLED'] },
    },
  });

  return { applies: true, limit, used, remaining: Math.max(0, limit - used), allowed: used < limit };
}
