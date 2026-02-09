import { NextRequest, NextResponse } from 'next/server';

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
 * POST /api/ip/add
 * Proxies to Taxii 2.x: POST /ip/add with body { "ip": "1.2.3.4" }.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ip = typeof body.ip === 'string' ? body.ip.trim() : '';
    if (!ip) {
      return NextResponse.json(
        { error: 'IP address is required' },
        { status: 400 }
      );
    }
    const base = process.env.THREATFEED_API_URL?.replace(/\/$/, '');
    if (!base) {
      return NextResponse.json(
        { error: 'THREATFEED_API_URL is not set' },
        { status: 500 }
      );
    }
    const res = await fetch(`${base}/ip/add`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ip }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg =
        (data as { detail?: { error?: string }; error?: string }).detail?.error ??
        (data as { error?: string }).error ??
        (data as { message?: string }).message ??
        (res.status === 404
          ? 'ip.txt not found on server. Create it first or use an API that supports add.'
          : `API returned ${res.status}`);
      return NextResponse.json(
        { error: errMsg },
        { status: res.status }
      );
    }
    return NextResponse.json({ message: 'Added', ip });
  } catch (e) {
    console.error('IP add error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to add IP' },
      { status: 500 }
    );
  }
}
