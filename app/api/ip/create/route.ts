import { NextResponse } from 'next/server';

function getAuthHeader(): string {
  const user = process.env.THREATFEED_USER;
  const pass = process.env.THREATFEED_PASSWORD;
  if (!user || !pass) {
    throw new Error('THREATFEED_USER and THREATFEED_PASSWORD must be set');
  }
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

/**
 * POST /api/ip/create
 * Creates an empty ip.txt on the Threat Feed API (if it doesn't exist).
 */
export async function POST() {
  try {
    const base = process.env.THREATFEED_API_URL?.replace(/\/$/, '');
    if (!base) {
      return NextResponse.json(
        { error: 'THREATFEED_API_URL is not set' },
        { status: 500 }
      );
    }
    const res = await fetch(`${base}/api/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify({ filename: 'ip.txt', content: '' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            data.detail ||
            data.message ||
            (res.status === 400 ? 'ip.txt may already exist' : `API returned ${res.status}`),
        },
        { status: res.status }
      );
    }
    return NextResponse.json({
      message: data.message || 'ip.txt created',
      filename: 'ip.txt',
    });
  } catch (e) {
    console.error('IP create error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create ip.txt' },
      { status: 500 }
    );
  }
}
