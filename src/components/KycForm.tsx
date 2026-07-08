'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function KycForm() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/kyc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentType: fd.get('documentType'), documentRef: fd.get('documentRef') }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(data.error);
    router.refresh();
  }

  return (
    <section className="card border-marigold/40 p-6">
      <h2 className="font-display text-lg font-bold">Complete KYC verification</h2>
      <p className="mb-4 mt-1 text-sm text-ink/60">
        Needed for One-Way rides and for outstation or evening/night car pools. Bike pools never
        need KYC. Documents are checked via DigiLocker and reviewed by our team.
      </p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="documentType">Document</label>
          <select id="documentType" name="documentType" className="input">
            <option value="AADHAAR">Aadhaar (DigiLocker)</option>
            <option value="DRIVING_LICENSE">Driving licence (Vahan)</option>
            <option value="PAN">PAN card</option>
          </select>
        </div>
        <div className="min-w-52 flex-1">
          <label className="label" htmlFor="documentRef">Document number</label>
          <input id="documentRef" name="documentRef" className="input" required />
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit for review'}</button>
      </form>
      {msg && <p className="mt-2 text-sm text-signal">{msg}</p>}
    </section>
  );
}
