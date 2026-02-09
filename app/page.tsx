'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
function isValidIp(line: string): boolean {
  return IPV4_REGEX.test(line.trim());
}

export default function IpListPage() {
  const [ips, setIps] = useState<string[]>([]);
  const [listMessage, setListMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [cloudsekLoading, setCloudsekLoading] = useState(false);
  const [quickFetchLoading, setQuickFetchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addValue, setAddValue] = useState('');
  const [addIpLoading, setAddIpLoading] = useState(false);
  const [deletingIp, setDeletingIp] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const searchLower = searchQuery.trim().toLowerCase();
  const filteredIps = searchLower
    ? ips.filter((ip) => ip.toLowerCase().includes(searchLower))
    : ips;
  const suggestions = searchLower
    ? ips
        .filter((ip) => ip.toLowerCase().includes(searchLower))
        .slice(0, 10)
    : [];

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    setListMessage(null);
    try {
      const res = await fetch('/api/ip/list', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setIps(Array.isArray(data.ips) ? data.ips : []);
      if (typeof data.message === 'string') setListMessage(data.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ip.txt');
      setIps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchList();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSuggestionOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const ip = addValue.trim();
    if (!ip || addIpLoading) return;
    setError(null);
    if (ips.some((existing) => existing === ip)) {
      setError(`"${ip}" is already in the blocklist.`);
      return;
    }
    setAddIpLoading(true);
    try {
      const res = await fetch('/api/ip/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add');
      setAddValue('');
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add IP');
    } finally {
      setAddIpLoading(false);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadLoading) return;
    setError(null);
    setUploadResult(null);
    setUploadLoading(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      // Deduplicate without relying on iterable spread of Set (for older TS targets)
      const seen = new Set<string>();
      const validIps: string[] = [];
      for (const line of lines) {
        if (!isValidIp(line)) continue;
        if (seen.has(line)) continue;
        seen.add(line);
        validIps.push(line);
      }
      const skipped = lines.length - validIps.length;
      let added = 0;
      let failed = 0;
      for (const ip of validIps) {
        const res = await fetch('/api/ip/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip }),
        });
        const data = await res.json();
        if (res.ok) added += 1;
        else if (data.message?.toLowerCase().includes('already') || data.error?.toLowerCase().includes('already')) added += 0;
        else failed += 1;
      }
      await fetchList();
      const parts = [`${added} IP(s) added`];
      if (skipped > 0) parts.push(`${skipped} non-IP line(s) ignored`);
      if (failed > 0) parts.push(`${failed} failed`);
      setUploadResult(parts.join('. '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadLoading(false);
      e.target.value = '';
    }
  };

  const handleQuickFetch = async () => {
    setQuickFetchLoading(true);
    setError(null);
    setUploadResult(null);
    try {
      const res = await fetch('/api/ip/refresh-cloudsek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Quick fetch failed');
      setUploadResult(data.message ?? 'ip.txt updated from CloudSEK.');
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Quick fetch failed');
    } finally {
      setQuickFetchLoading(false);
    }
  };

  const handleFetchDaily = async () => {
    setCloudsekLoading(true);
    setError(null);
    setUploadResult(null);
    try {
      const res = await fetch('/api/ip/fetch-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run daily fetch');
      const msg = data.message ?? 'Daily fetch completed.';
      const extra =
        data.total_fetched != null || data.total_new != null
          ? ` Fetched: ${data.total_fetched ?? 0}, new: ${data.total_new ?? 0}.`
          : '';
      setUploadResult(msg + extra);
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run daily fetch');
    } finally {
      setCloudsekLoading(false);
    }
  };

  const handleDelete = async (ip: string) => {
    setDeletingIp(ip);
    setError(null);
    try {
      const res = await fetch(`/api/ip/delete?ip=${encodeURIComponent(ip)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeletingIp(null);
    }
  };

  return (
    <div className="app-wrap">
      <nav className="top-nav">
        <div className="top-nav-inner">
          <Link href="/" className="top-nav-link active">
            SVI IP blocklist manager
          </Link>
          <Link href="/chat" className="top-nav-link">
            Chat
          </Link>
        </div>
      </nav>

      <main className="ip-page">
        <header className="ip-page-header">
          <h1>SVI IP blocklist manager</h1>
          <p className="ip-page-desc">
            View, add, and remove IPs from the SVI blocklist via the API.
          </p>
        </header>

        <section className="ip-page-actions">
          <form onSubmit={handleAdd} className="ip-page-form">
            <input
              type="text"
              value={addValue}
              onChange={(e) => setAddValue(e.target.value)}
              placeholder="IP address to add"
              disabled={loading}
              className="ip-page-input"
            />
            <button
              type="submit"
              className="ip-page-btn primary"
              disabled={!addValue.trim() || addIpLoading}
            >
              {addIpLoading ? 'Adding…' : 'Add'}
            </button>
          </form>
          <button
            type="button"
            className="ip-page-btn secondary"
            onClick={fetchList}
            disabled={loading}
          >
            Refresh list
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            className="ip-page-file-input"
            onChange={handleUploadFile}
            disabled={uploadLoading}
            aria-label="Upload txt file"
          />
          <button
            type="button"
            className="ip-page-btn secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploadLoading}
          >
            {uploadLoading ? 'Uploading…' : 'Upload txt file'}
          </button>
          <button
            type="button"
            className="ip-page-btn cloudsek"
            onClick={handleQuickFetch}
            disabled={loading || quickFetchLoading}
            title="Fetch IPv4 IOCs from CloudSEK (last 7 days) and merge new IPs into ip.txt."
          >
            {quickFetchLoading ? 'Fetching…' : 'Quick fetch'}
          </button>
          <button
            type="button"
            className="ip-page-btn cloudsek"
            onClick={handleFetchDaily}
            disabled={loading || cloudsekLoading}
            title="Runs daily fetch: yesterday's IOCs written to output files."
          >
            {cloudsekLoading ? 'Fetching…' : 'Fetch daily'}
          </button>
          <span className="ip-page-hint">
            Quick fetch: merge CloudSEK IPs into ip.txt. Daily: yesterday’s IOCs to output files.
          </span>
        </section>

        {error && (
          <div className="ip-page-error" role="alert">
            {error}
          </div>
        )}
        {uploadResult && (
          <div className="ip-page-success" role="status">
            {uploadResult}
          </div>
        )}

        <section className="ip-page-list-wrap">
          <div className="ip-page-list-header">
            <h2 className="ip-page-list-title">
              Current list ({filteredIps.length}{searchQuery.trim() ? ` of ${ips.length}` : ''} IPs)
            </h2>
            <div className="ip-page-search-wrap" ref={searchRef}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSuggestionOpen(true);
                }}
                onFocus={() => setSuggestionOpen(true)}
                placeholder="Search IP…"
                className="ip-page-search-input"
                aria-label="Search IPs"
              />
              {suggestionOpen && suggestions.length > 0 && (
                <ul className="ip-page-suggestions" role="listbox">
                  {suggestions.map((ip) => (
                    <li
                      key={ip}
                      role="option"
                      className="ip-page-suggestion-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchQuery(ip);
                        setSuggestionOpen(false);
                      }}
                    >
                      {ip}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {listMessage && (
            <p className="ip-page-list-message">{listMessage}</p>
          )}
          {loading ? (
            <p className="ip-page-loading">Loading…</p>
          ) : filteredIps.length === 0 ? (
            <p className="ip-page-empty">
              {ips.length === 0 ? 'No IPs in blocklist.' : 'No IPs match your search.'}
            </p>
          ) : (
            <ul className="ip-page-list">
              {filteredIps.map((ip) => (
                <li key={ip} className="ip-page-list-item">
                  <span className="ip-page-list-ip">{ip}</span>
                  <button
                    type="button"
                    className="ip-page-btn delete"
                    onClick={() => handleDelete(ip)}
                    disabled={deletingIp === ip}
                    aria-label={`Remove ${ip}`}
                  >
                    {deletingIp === ip ? 'Removing…' : 'Remove'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
