'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: fd.get('phone'), password: fd.get('password') }),
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
      <h1 className="font-display mb-6 mt-6 text-center text-3xl font-bold">Welcome back</h1>
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label className="label" htmlFor="phone">Mobile number</label>
          <input id="phone" name="phone" className="input" placeholder="10-digit number" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" className="input" required />
        </div>
        {error && <p className="text-sm text-signal">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-center text-sm text-ink/60">
          New here? <Link className="font-semibold text-marigoldDeep" href="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
