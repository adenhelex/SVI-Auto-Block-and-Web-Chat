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
 * POST /api/ip/fetch-daily
 * Proxies to Taxii 2.x: POST /fetch/daily
 * Run daily fetch (yesterday or given date), write to output files.
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
    let body: { date?: string; output_dir?: string } = {};
    try {
      body = await request.json();
    } catch {
      // empty body is ok
    }
    const res = await fetch(`${base}/fetch/daily`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        date: body.date ?? undefined,
        output_dir: body.output_dir ?? undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg =
        (data as { error?: string }).error ??
        (data as { detail?: string }).detail ??
        (data as { message?: string }).message ??
        `API returned ${res.status}`;
      return NextResponse.json(
        { error: errMsg },
        { status: res.status }
      );
    }
    const payload = data as {
      status?: string;
      date?: string;
      total_fetched?: number;
      total_new?: number;
      counts?: Record<string, number>;
      output_dir?: string;
    };
    const msg =
      payload.status === 'error'
        ? (data as { error?: string }).error ?? 'Daily fetch failed'
        : `Daily fetch done for ${payload.date ?? 'date'}. Fetched: ${payload.total_fetched ?? 0}, new: ${payload.total_new ?? 0}.`;
    return NextResponse.json({
      message: msg,
      date: payload.date,
      total_fetched: payload.total_fetched,
      total_new: payload.total_new,
      counts: payload.counts,
    });
  } catch (e) {
    console.error('Fetch daily error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to run daily fetch' },
      { status: 500 }
    );
  }
}
