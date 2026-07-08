'use client';
import { useRouter } from 'next/navigation';

export default function LogoutButton({ name }: { name: string }) {
  const router = useRouter();
  return (
    <button
      className="btn-ghost !py-1.5"
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
        router.refresh();
      }}
    >
      {name.split(' ')[0]} · Sign out
    </button>
  );
}
