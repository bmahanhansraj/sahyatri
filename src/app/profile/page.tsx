import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkAdhocQuota } from '@/lib/quota';
import KycForm from '@/components/KycForm';

export const dynamic = 'force-dynamic';

const KYC_LABEL: Record<string, string> = {
  NOT_SUBMITTED: 'Not started',
  PENDING: 'Under review',
  APPROVED: 'Verified',
  REJECTED: 'Rejected — resubmit',
  EXPIRED: 'Expired — resubmit',
  PRE_VERIFIED: 'Pre-verified (corporate)',
};

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const [bookings, myRides] = await Promise.all([
    prisma.booking.findMany({
      where: { riderId: user.id },
      include: { ride: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.ride.findMany({ where: { driverId: user.id }, orderBy: { departAt: 'desc' }, take: 20 }),
  ]);

  const isNonCommercial = user.roles.includes('NON_COMMERCIAL_DRIVER');
  const carQuota = isNonCommercial ? await checkAdhocQuota(user.id, user.roles, 'CAR') : null;
  const bikeQuota = isNonCommercial ? await checkAdhocQuota(user.id, user.roles, 'BIKE') : null;
  const verified = ['APPROVED', 'PRE_VERIFIED'].includes(user.kycStatus);

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">{user.name}</h1>
            <p className="text-sm text-ink/60">{user.phone} · {user.roles.map((r) => r.replaceAll('_', ' ').toLowerCase()).join(', ')}</p>
          </div>
          <span className={verified ? 'badge-verified' : 'badge-kyc'}>
            {verified ? '✓ ' : ''}KYC: {KYC_LABEL[user.kycStatus]}
          </span>
        </div>
        {isNonCommercial && carQuota && bikeQuota && (
          <p className="mt-3 rounded-xl bg-ink/[0.03] p-3 text-sm">
            This week's ad-hoc routes: <strong>{carQuota.used} of {carQuota.limit}</strong> car ·{' '}
            <strong>{bikeQuota.used} of {bikeQuota.limit}</strong> bike. Quota resets on a rolling 7-day basis.
          </p>
        )}
      </section>

      {!verified && user.kycStatus !== 'PENDING' && <KycForm />}

      <section>
        <h2 className="font-display mb-3 text-xl font-bold">Rides you're driving</h2>
        {myRides.length === 0 ? (
          <p className="text-sm text-ink/60">Nothing published yet.</p>
        ) : (
          <ul className="space-y-2">
            {myRides.map((r) => (
              <li key={r.id} className="card flex items-center justify-between p-4 text-sm">
                <div>
                  <p className="font-semibold">{r.origin} → {r.destination}</p>
                  <p className="text-xs text-ink/60">
                    {new Date(r.departAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    {' · '}{r.seatsBooked}/{r.seatsTotal} booked · ₹{r.farePerSeat}/seat
                  </p>
                </div>
                <span className="badge-type">{r.status.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display mb-3 text-xl font-bold">Your bookings</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-ink/60">No bookings yet — find a ride from the home page.</p>
        ) : (
          <ul className="space-y-2">
            {bookings.map((b) => (
              <li key={b.id} className="card flex items-center justify-between p-4 text-sm">
                <div>
                  <p className="font-semibold">{b.ride.origin} → {b.ride.destination}</p>
                  <p className="text-xs text-ink/60">
                    {new Date(b.ride.departAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    {' · '}{b.seats} seat(s) · fare ₹{b.fareTotal} + fee ₹{b.bookingFee} + GST ₹{b.gstOnFee}
                    {b.qrCode && <> · ticket <code className="rounded bg-ink/5 px-1">{b.qrCode}</code></>}
                  </p>
                </div>
                <span className="badge-type">{b.status.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
