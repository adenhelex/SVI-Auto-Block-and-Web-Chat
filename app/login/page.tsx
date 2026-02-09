'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      const next = params.get('next') || '/';
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      window.location.href = next;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

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
          <header className="ip-page-header">
            <h1>Sign in</h1>
            <p className="ip-page-desc">
              Use your operator credentials to manage the IP blocklist and SecBot.
            </p>
          </header>

          {error && (
            <div className="ip-page-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="ip-page-form login-form">
            <div className="login-field">
              <label htmlFor="username" className="ip-page-desc login-label">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="ip-page-input"
                placeholder="Username"
                autoComplete="username"
              />
            </div>
            <div className="login-field">
              <label htmlFor="password" className="ip-page-desc login-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ip-page-input"
                placeholder="Password"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="ip-page-btn primary login-submit"
              disabled={!username.trim() || !password.trim() || loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

