import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import KycQueue from '@/components/KycQueue';
import ConfigPanel from '@/components/ConfigPanel';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await currentUser();
  const staffRoles = ['SUPER_ADMIN', 'KYC_APPROVER', 'CUSTOMER_SUPPORT'];
  if (!user || !user.roles.some((r) => staffRoles.includes(r))) redirect('/');

  const isSuperAdmin = user.roles.includes('SUPER_ADMIN');
  const canReviewKyc = isSuperAdmin || user.roles.includes('KYC_APPROVER');

  const [pendingKyc, openAlerts, stats, recentAudit] = await Promise.all([
    canReviewKyc
      ? prisma.kycSubmission.findMany({
          where: { status: 'PENDING' },
          include: { user: { select: { name: true, phone: true, roles: true } } },
          orderBy: { createdAt: 'asc' },
        })
      : Promise.resolve([]),
    prisma.safetyAlert.findMany({
      where: { status: { in: ['OPEN', 'ESCALATED'] } },
      include: { ride: { select: { origin: true, destination: true, driver: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    Promise.all([
      prisma.user.count(),
      prisma.ride.count({ where: { status: 'PUBLISHED' } }),
      prisma.booking.count(),
      prisma.booking.aggregate({ _sum: { fareTotal: true, bookingFee: true } }),
    ]),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 15 }),
  ]);

  const [users, liveRides, totalBookings, revenue] = stats;

  return (
    <div className="space-y-8">
      <h1 className="font-display mt-2 text-3xl font-bold">Operations</h1>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Users', users],
          ['Live rides', liveRides],
          ['Bookings', totalBookings],
          ['Booking fees ₹', Math.round(revenue._sum.bookingFee ?? 0)],
        ].map(([label, value]) => (
          <div key={label as string} className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</p>
            <p className="font-display mt-1 text-2xl font-bold">{value as number}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-display mb-3 text-xl font-bold">
          Live safety alerts {openAlerts.length > 0 && <span className="badge-kyc align-middle">{openAlerts.length} open</span>}
        </h2>
        {openAlerts.length === 0 ? (
          <p className="text-sm text-ink/60">All quiet — no open alerts across active trips.</p>
        ) : (
          <ul className="space-y-2">
            {openAlerts.map((a) => (
              <li key={a.id} className="card flex items-center justify-between border-signal/30 p-4 text-sm">
                <div>
                  <p className="font-semibold text-signal">{a.type.replaceAll('_', ' ')}</p>
                  <p className="text-xs text-ink/60">
                    {a.ride.origin} → {a.ride.destination} · driver {a.ride.driver.name} ·{' '}
                    {new Date(a.createdAt).toLocaleTimeString('en-IN')}
                  </p>
                </div>
                <span className="badge-type">{a.status.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canReviewKyc && <KycQueue initial={pendingKyc as any} />}
      {isSuperAdmin && <ConfigPanel />}

      <section>
        <h2 className="font-display mb-3 text-xl font-bold">Audit trail</h2>
        <ul className="card divide-y divide-line p-0 text-sm">
          {recentAudit.map((l) => (
            <li key={l.id} className="flex justify-between px-4 py-2.5">
              <span>{l.action}</span>
              <span className="text-xs text-ink/50">{new Date(l.createdAt).toLocaleString('en-IN')}</span>
            </li>
          ))}
          {recentAudit.length === 0 && <li className="px-4 py-3 text-ink/60">No events yet.</li>}
        </ul>
      </section>
    </div>
  );
}
