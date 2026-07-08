import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import LogoutButton from './LogoutButton';

export default async function Nav() {
  const user = await currentUser();
  const isDriver = user?.roles.some((r) =>
    ['NON_COMMERCIAL_DRIVER', 'COMMERCIAL_DRIVER', 'FLEET_OPERATOR'].includes(r)
  );
  const isStaff = user?.roles.some((r) => ['SUPER_ADMIN', 'KYC_APPROVER', 'CUSTOMER_SUPPORT'].includes(r));

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center" aria-label="Sahyatri home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Sahyatri" className="h-5 w-auto" />
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium">
          <Link className="btn-ghost !py-1.5" href="/">Find a ride</Link>
          {isDriver && <Link className="btn-ghost !py-1.5" href="/publish">Publish a ride</Link>}
          {user && <Link className="btn-ghost !py-1.5" href="/profile">My trips</Link>}
          {isStaff && <Link className="btn-ghost !py-1.5" href="/admin">Admin</Link>}
          {user ? (
            <LogoutButton name={user.name} />
          ) : (
            <Link className="btn-primary !py-1.5" href="/login">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
