'use client';
import { useEffect, useState } from 'react';

export default function ConfigPanel() {
  const [quota, setQuota] = useState({ CAR: 3, BIKE: 6 });
  const [fees, setFees] = useState({ POOL: 10, ONE_WAY: 25, BUS: 15 });
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/config').then(async (r) => {
      if (!r.ok) return;
      const cfg = await r.json();
      if (cfg['quota.weekly']) setQuota((q) => ({ ...q, ...cfg['quota.weekly'] }));
      if (cfg['fee.booking']) setFees((f) => ({ ...f, ...cfg['fee.booking'] }));
    });
  }, []);

  async function save(key: string, value: object) {
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    setSaved(res.ok ? 'Saved' : 'Could not save — try again');
    setTimeout(() => setSaved(null), 2000);
  }

  return (
    <section>
      <h2 className="font-display mb-3 text-xl font-bold">Platform settings</h2>
      <div className="card space-y-5 p-5 text-sm">
        <div>
          <p className="mb-2 font-semibold">Weekly ad-hoc route limits (non-commercial drivers)</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="qcar">Car / week</label>
              <input id="qcar" type="number" className="input w-24" value={quota.CAR} onChange={(e) => setQuota({ ...quota, CAR: +e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="qbike">Bike / week</label>
              <input id="qbike" type="number" className="input w-24" value={quota.BIKE} onChange={(e) => setQuota({ ...quota, BIKE: +e.target.value })} />
            </div>
            <button className="btn-ghost" onClick={() => save('quota.weekly', quota)}>Save limits</button>
          </div>
        </div>
        <div className="border-t border-line pt-4">
          <p className="mb-2 font-semibold">Booking fee per ride type (₹) — 18% GST applies on the fee</p>
          <div className="flex flex-wrap items-end gap-3">
            {(['POOL', 'ONE_WAY', 'BUS'] as const).map((t) => (
              <div key={t}>
                <label className="label" htmlFor={`fee-${t}`}>{t.replaceAll('_', ' ')}</label>
                <input id={`fee-${t}`} type="number" className="input w-24" value={fees[t]} onChange={(e) => setFees({ ...fees, [t]: +e.target.value })} />
              </div>
            ))}
            <button className="btn-ghost" onClick={() => save('fee.booking', fees)}>Save fees</button>
          </div>
        </div>
        {saved && <p className="text-teal">{saved}</p>}
      </div>
    </section>
  );
}
