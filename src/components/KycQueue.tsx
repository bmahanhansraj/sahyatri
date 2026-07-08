'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Item = {
  id: string;
  documentType: string;
  documentRef: string;
  createdAt: string;
  user: { name: string; phone: string; roles: string[] };
};

export default function KycQueue({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function decide(id: string, decision: 'APPROVED' | 'REJECTED') {
    setError(null);
    let remarks: string | null = null;
    if (decision === 'REJECTED') {
      remarks = window.prompt('Remarks are required when rejecting. Why is this being rejected?');
      if (!remarks?.trim()) return;
    }
    const res = await fetch('/api/kyc/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: id, decision, remarks }),
    });
    if (!res.ok) return setError((await res.json()).error);
    setItems((xs) => xs.filter((x) => x.id !== id));
    router.refresh();
  }

  return (
    <section>
      <h2 className="font-display mb-3 text-xl font-bold">
        KYC review queue {items.length > 0 && <span className="badge-type align-middle">{items.length} pending</span>}
      </h2>
      {error && <p className="mb-2 text-sm text-signal">{error}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-ink/60">Queue is clear.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <li key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-semibold">{s.user.name} · {s.user.phone}</p>
                <p className="text-xs text-ink/60">
                  {s.documentType.replaceAll('_', ' ')} · {s.documentRef} · submitted{' '}
                  {new Date(s.createdAt).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary !py-1.5" onClick={() => decide(s.id, 'APPROVED')}>Approve</button>
                <button className="btn-danger !py-1.5" onClick={() => decide(s.id, 'REJECTED')}>Reject</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
