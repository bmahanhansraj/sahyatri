'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Fare = { suggested: number; min: number; max: number; surged: boolean; kycRequired: boolean };

export default function PublishPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    listingType: 'POOL',
    vehicleType: 'CAR',
    scheduleType: 'ONE_TIME',
    origin: '',
    destination: '',
    distanceKm: 10,
    departAt: '',
    seatsTotal: 3,
    farePerSeat: 0,
    womenOnly: false,
  });
  const [fare, setFare] = useState<Fare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  // AI-assisted fare + ETA + KYC preview updates as the route takes shape (PRD §4.1, §10.1)
  useEffect(() => {
    if (!form.departAt || !form.distanceKm) return;
    const t = setTimeout(async () => {
      const res = await fetch('/api/rides/fare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleType: form.vehicleType,
          listingType: form.listingType,
          distanceKm: Number(form.distanceKm),
          departAt: new Date(form.departAt).toISOString(),
        }),
      });
      if (res.ok) {
        const f = await res.json();
        setFare(f);
        setForm((prev) => ({ ...prev, farePerSeat: prev.farePerSeat || f.suggested }));
      }
    }, 300);
    return () => clearTimeout(t);
  }, [form.vehicleType, form.listingType, form.distanceKm, form.departAt]);

  async function publish(asDraft: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/rides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        distanceKm: Number(form.distanceKm),
        seatsTotal: Number(form.seatsTotal),
        farePerSeat: Number(form.farePerSeat),
        departAt: new Date(form.departAt).toISOString(),
        asDraft,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error);
      if (data.kycGate) router.push('/profile?kyc=1');
      return;
    }
    router.push('/profile');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display mb-1 mt-4 text-3xl font-bold">Publish a ride</h1>
      <p className="mb-6 text-sm text-ink/60">
        Set your route, schedule, seats and fare — riders see it the moment you publish.
      </p>

      <div className="card space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="listingType">Listing type</label>
            <select id="listingType" className="input" value={form.listingType}
              onChange={(e) => {
                const lt = e.target.value;
                set('listingType', lt);
                if (lt === 'ONE_WAY' || lt === 'BUS') set('vehicleType', lt === 'BUS' ? 'BUS' : 'CAR');
              }}>
              <option value="POOL">Pool — shared seats</option>
              <option value="ONE_WAY">One-Way — point to point</option>
              <option value="BUS">Bus — fleet route</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="vehicleType">Vehicle</label>
            <select id="vehicleType" className="input" value={form.vehicleType}
              disabled={form.listingType !== 'POOL'}
              onChange={(e) => set('vehicleType', e.target.value)}>
              {form.listingType === 'POOL' && <option value="BIKE">Bike</option>}
              {form.listingType !== 'BUS' && <option value="CAR">Car</option>}
              {form.listingType === 'BUS' && <option value="BUS">Bus</option>}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="scheduleType">Schedule</label>
            <select id="scheduleType" className="input" value={form.scheduleType} onChange={(e) => set('scheduleType', e.target.value)}>
              <option value="ONE_TIME">One-time (ad-hoc)</option>
              <option value="RECURRING">Daily commute</option>
            </select>
          </div>
        </div>

        <div className="route-line space-y-3 py-1">
          <span className="route-dot route-dot--origin" aria-hidden />
          <div>
            <label className="label" htmlFor="origin">Pickup point</label>
            <input id="origin" className="input" value={form.origin} onChange={(e) => set('origin', e.target.value)} placeholder="e.g. HSR Layout, Bengaluru" />
          </div>
          <span className="route-dot route-dot--dest" aria-hidden />
          <div>
            <label className="label" htmlFor="destination">Drop point</label>
            <input id="destination" className="input" value={form.destination} onChange={(e) => set('destination', e.target.value)} placeholder="e.g. Electronic City" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="distanceKm">Distance (km)</label>
            <input id="distanceKm" type="number" min={1} step={0.5} className="input" value={form.distanceKm} onChange={(e) => set('distanceKm', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="departAt">Departure</label>
            <input id="departAt" type="datetime-local" className="input" value={form.departAt} onChange={(e) => set('departAt', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="seatsTotal">Seats</label>
            <input id="seatsTotal" type="number" min={1} max={60} className="input" value={form.seatsTotal} onChange={(e) => set('seatsTotal', e.target.value)} />
          </div>
        </div>

        {fare && (
          <div className="rounded-xl bg-ink/[0.03] p-4 text-sm">
            <p>
              Suggested fare <strong className="font-display text-base">₹{fare.suggested}</strong> per seat
              {fare.surged && <span className="badge bg-marigold/15 text-marigoldDeep ml-2">Night rate</span>}
              <span className="text-ink/50"> · you can set ₹{fare.min}–₹{fare.max}</span>
            </p>
            {fare.kycRequired && (
              <p className="mt-1.5 text-signal">
                This ride requires KYC — outstation or evening/night trips, and all One-Way rides, need verified profiles.
              </p>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="farePerSeat">Your fare per seat (₹)</label>
            <input id="farePerSeat" type="number" className="input" value={form.farePerSeat} onChange={(e) => set('farePerSeat', e.target.value)} />
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.womenOnly} onChange={(e) => set('womenOnly', e.target.checked)} className="h-4 w-4 accent-marigold" />
            Women-only pool
          </label>
        </div>

        {error && <p className="text-sm text-signal">{error}</p>}

        <div className="flex gap-3 border-t border-line pt-4">
          <button className="btn-primary flex-1" disabled={busy || !form.origin || !form.destination || !form.departAt} onClick={() => publish(false)}>
            {busy ? 'Publishing…' : 'Review & publish'}
          </button>
          <button className="btn-ghost" disabled={busy} onClick={() => publish(true)}>Save as draft</button>
        </div>
      </div>
    </div>
  );
}
