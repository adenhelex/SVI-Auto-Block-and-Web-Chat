import { NextResponse } from 'next/server';

// Always fetch fresh data for this route – no static caching
export const dynamic = 'force-dynamic';

/** Optional Basic Auth (Taxii 2.x server.py has no auth; other backends may). */
function getHeaders(): Record<string, string> {
  const user = process.env.THREATFEED_USER;
  const pass = process.env.THREATFEED_PASSWORD;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user && pass) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  }
  return headers;
}

/**
 * GET /api/ip/list
 * Proxies to Taxii 2.x: GET /ip/file (raw ip.txt, one IP per line).
 * Uses the file endpoint so the list always reflects what's in ip.txt after add/delete.
 */
export async function GET() {
  try {
    const base = process.env.THREATFEED_API_URL?.replace(/\/$/, '');
    if (!base) {
      return NextResponse.json(
        { error: 'THREATFEED_API_URL is not set' },
        { status: 500 }
      );
    }
    const res = await fetch(`${base}/ip/file`, {
      headers: getHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text();
      let errMsg = text;
      try {
        const err = JSON.parse(text) as { detail?: string; error?: string; message?: string };
        errMsg = err.detail || err.error || err.message || text;
      } catch {
        // use raw text
      }
      if (res.status === 404) {
        return NextResponse.json({
          ips: [],
          message: 'ip.txt not found on server. Add an IP below to create it.',
        });
      }
      return NextResponse.json(
        { error: errMsg || `API returned ${res.status}` },
        { status: res.status }
      );
    }
    const text = await res.text();
    const ips = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return NextResponse.json({ ips });
  } catch (e) {
    console.error('IP list error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch ip.txt' },
      { status: 500 }
    );
  }
}
