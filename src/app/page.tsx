import Link from 'next/link';
import { prisma } from '@/lib/db';
import BookButton from '@/components/BookButton';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = { POOL: 'Pool', ONE_WAY: 'One-Way', BUS: 'Bus' };

export default async function Home({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; womenOnly?: string; maxPrice?: string };
}) {
  const user = await currentUser();
  const rides = await prisma.ride.findMany({
    where: {
      status: 'PUBLISHED',
      departAt: { gte: new Date() },
      ...(searchParams.type ? { listingType: searchParams.type as any } : {}),
      ...(searchParams.womenOnly === '1' ? { womenOnly: true } : {}),
      ...(searchParams.maxPrice ? { farePerSeat: { lte: Number(searchParams.maxPrice) } } : {}),
      ...(searchParams.q
        ? {
            OR: [
              { origin: { contains: searchParams.q, mode: 'insensitive' } },
              { destination: { contains: searchParams.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { driver: { select: { name: true, kycStatus: true, safetyScore: true } } },
    orderBy: { departAt: 'asc' },
    take: 50,
  });

  return (
    <div>
      <section className="mb-8 mt-2">
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight">
          Same road. <span className="text-marigoldDeep">Shared ride.</span>
        </h1>
        <p className="mt-2 max-w-xl text-ink/70">
          Pools, one-way rides and buses from verified drivers — for your daily commute or the
          occasional trip out of town.
        </p>
      </section>

      <form className="card mb-6 flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="q">From or to</label>
          <input id="q" name="q" defaultValue={searchParams.q} className="input" placeholder="e.g. Whitefield, Pune, Sector 62…" />
        </div>
        <div>
          <label className="label" htmlFor="type">Ride type</label>
          <select id="type" name="type" defaultValue={searchParams.type ?? ''} className="input">
            <option value="">All types</option>
            <option value="POOL">Pool</option>
            <option value="ONE_WAY">One-Way</option>
            <option value="BUS">Bus</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="maxPrice">Max fare (₹)</label>
          <input id="maxPrice" name="maxPrice" type="number" defaultValue={searchParams.maxPrice} className="input w-28" placeholder="Any" />
        </div>
        <label className="mb-2.5 flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="womenOnly" value="1" defaultChecked={searchParams.womenOnly === '1'} className="h-4 w-4 accent-marigold" />
          Women-only
        </label>
        <button className="btn-primary" type="submit">Search rides</button>
      </form>

      {rides.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-display text-lg font-semibold">No rides match yet</p>
          <p className="mt-1 text-sm text-ink/60">
            Widen your search, or be the first to publish this route.
          </p>
          <Link href="/publish" className="btn-primary mt-4">Publish a ride</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rides.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="badge-type">{TYPE_LABEL[r.listingType]} · {r.vehicleType.toLowerCase()}</span>
                <div className="flex gap-1.5">
                  {r.womenOnly && <span className="badge bg-purple-100 text-purple-700">Women-only</span>}
                  {r.kycRequired && <span className="badge-kyc">KYC needed</span>}
                </div>
              </div>
              <div className="route-line mb-3">
                <span className="route-dot route-dot--origin" aria-hidden />
                <p className="font-semibold leading-snug">{r.origin}</p>
                <p className="py-1 text-xs text-ink/50">{r.distanceKm} km · ~{r.etaMinutes} min</p>
                <span className="route-dot route-dot--dest" aria-hidden />
                <p className="font-semibold leading-snug">{r.destination}</p>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
                <div>
                  <p className="font-medium">
                    {r.driver.name}{' '}
                    {['APPROVED', 'PRE_VERIFIED'].includes(r.driver.kycStatus) && (
                      <span className="badge-verified">✓ Verified</span>
                    )}
                  </p>
                  <p className="text-xs text-ink/60">
                    {new Date(r.departAt).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })}
                    {' · '}{r.seatsTotal - r.seatsBooked} seat(s) left
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold">₹{r.farePerSeat}</p>
                  <BookButton rideId={r.id} signedIn={!!user} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
