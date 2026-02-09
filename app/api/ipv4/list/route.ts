import { NextRequest, NextResponse } from 'next/server';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const user = process.env.THREATFEED_USER;
  const pass = process.env.THREATFEED_PASSWORD;
  if (user && pass) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  }
  return headers;
}

/**
 * GET /api/ipv4/list
 * Taxii 2.x: GET /api/files/ipv4.txt returns plain text (one IP per line).
 */
export async function GET(request: NextRequest) {
  try {
    const base = process.env.THREATFEED_API_URL?.replace(/\/$/, '');
    if (!base) {
      return NextResponse.json(
        { error: 'THREATFEED_API_URL is not set' },
        { status: 500 }
      );
    }
    const url = `${base}/api/files/ipv4.txt`;
    const res = await fetch(url, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: text || `Threat Feed API returned ${res.status}` },
        { status: res.status }
      );
    }
    const contentType = res.headers.get('content-type') || '';
    let lines: string[];
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as { content?: string };
      const content = data.content ?? '';
      lines = content.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
    } else {
      const text = await res.text();
      lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    }
    return NextResponse.json({ ips: lines });
  } catch (e) {
    console.error('ipv4 list error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch ipv4.txt' },
      { status: 500 }
    );
  }
}
