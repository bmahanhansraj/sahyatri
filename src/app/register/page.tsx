'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asDriver, setAsDriver] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fd.get('name'),
        phone: fd.get('phone'),
        password: fd.get('password'),
        gender: fd.get('gender') || undefined,
        asDriver,
        driverType: asDriver ? fd.get('driverType') : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error);
    router.push('/');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="Sahyatri" className="mx-auto mt-10 h-9 w-auto" />
      <h1 className="font-display mb-6 mt-6 text-center text-3xl font-bold">Join Sahyatri</h1>
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" name="name" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="phone">Mobile number</label>
          <input id="phone" name="phone" className="input" placeholder="10-digit number" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" className="input" minLength={6} required />
        </div>
        <div>
          <label className="label" htmlFor="gender">Gender (for women-only pools)</label>
          <select id="gender" name="gender" className="input">
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={asDriver} onChange={(e) => setAsDriver(e.target.checked)} className="h-4 w-4 accent-marigold" />
          I also want to drive and publish rides
        </label>
        {asDriver && (
          <div>
            <label className="label" htmlFor="driverType">Driver type</label>
            <select id="driverType" name="driverType" className="input">
              <option value="NON_COMMERCIAL_DRIVER">Personal vehicle — daily commute (weekly ad-hoc limits apply)</option>
              <option value="COMMERCIAL_DRIVER">Commercial / professional (unlimited routes)</option>
            </select>
          </div>
        )}
        {error && <p className="text-sm text-signal">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="text-center text-sm text-ink/60">
          Already registered? <Link className="font-semibold text-marigoldDeep" href="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
