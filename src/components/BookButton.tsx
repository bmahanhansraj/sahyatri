'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BookButton({ rideId, signedIn }: { rideId: string; signedIn: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function book() {
    if (!signedIn) return router.push('/login');
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId, seats: 1, paymentMethod: 'CASH' }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error);
      if (data.kycGate) router.push('/profile?kyc=1');
      return;
    }
    router.push('/profile');
    router.refresh();
  }

  return (
    <div className="mt-1">
      <button className="btn-primary !px-3 !py-1.5" onClick={book} disabled={busy}>
        {busy ? 'Booking…' : 'Book seat'}
      </button>
      {msg && <p className="mt-1 max-w-44 text-right text-xs text-signal">{msg}</p>}
    </div>
  );
}
