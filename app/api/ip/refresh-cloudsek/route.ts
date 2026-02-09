import { NextRequest, NextResponse } from 'next/server';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const user = process.env.THREATFEED_USER;
  const pass = process.env.THREATFEED_PASSWORD;
  if (user && pass) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  }
  return headers;
}

/**
 * POST /api/ip/refresh-cloudsek
 * Proxies to Taxii 2.x: POST /ip/refresh-from-cloudsek
 * Fetch IPv4 from CloudSEK (last 7 days), merge new IPs into ip.txt.
 */
export async function POST(request: NextRequest) {
  try {
    const base = process.env.THREATFEED_API_URL?.replace(/\/$/, '');
    if (!base) {
      return NextResponse.json(
        { error: 'THREATFEED_API_URL is not set' },
        { status: 500 }
      );
    }
    let body: { days?: number; limit?: number; valid_only?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // empty body is ok
    }
    const res = await fetch(`${base}/ip/refresh-from-cloudsek`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        days: body.days ?? 7,
        limit: body.limit ?? undefined,
        valid_only: body.valid_only ?? true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg =
        (data as { detail?: { error?: string }; error?: string }).detail?.error ??
        (data as { error?: string }).error ??
        (data as { message?: string }).message ??
        `API returned ${res.status}`;
      return NextResponse.json(
        { error: errMsg },
        { status: res.status }
      );
    }
    const payload = data as { status?: string; fetched_from_cloudsek?: number; total_in_file?: number };
    return NextResponse.json({
      message: `Updated from CloudSEK. Fetched: ${payload.fetched_from_cloudsek ?? 0}, total in file: ${payload.total_in_file ?? 0}.`,
      ...payload,
    });
  } catch (e) {
    console.error('Refresh CloudSEK error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to refresh from CloudSEK' },
      { status: 500 }
    );
  }
}
