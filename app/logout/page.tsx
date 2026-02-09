'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        await fetch('/api/logout', { method: 'POST' });
      } catch {
        // ignore network errors; we'll still redirect to login
      } finally {
        router.replace('/login');
      }
    };
    void run();
  }, [router]);

  return (
    <div className="app-wrap">
      <nav className="top-nav">
        <div className="top-nav-inner">
          <Link href="/" className="top-nav-link">
            SVI IP blocklist manager
          </Link>
          <Link href="/chat" className="top-nav-link">
            Chat
          </Link>
        </div>
      </nav>
      <main className="login-layout">
        <div className="login-card">
          <h1 className="ip-page-header">Signing you out…</h1>
          <p className="ip-page-desc">You will be redirected to the login page.</p>
        </div>
      </main>
    </div>
  );
}

