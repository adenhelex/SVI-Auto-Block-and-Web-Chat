import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password.trim() : '';

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const dbApiUrl = process.env.LOCALDB_API_URL || 'https://dbapi.iamdeveloper.xyz/execute';
    const dbApiKey = process.env.LOCALDB_API_KEY;

    if (!dbApiKey) {
      return NextResponse.json(
        { error: 'Database auth is required but LOCALDB_API_KEY is not set' },
        { status: 500 },
      );
    }

    // Strictly DB-based authentication: no env fallback.
    // Expect a "users" table with at least (username TEXT UNIQUE, password TEXT) columns.
    const safeUser = username.replace(/'/g, "''");
    const safePass = password.replace(/'/g, "''");
    const sql = `SELECT COUNT(*) AS cnt FROM users WHERE username='${safeUser}' AND password='${safePass}'`;

    const dbRes = await fetch(dbApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': dbApiKey,
      },
      body: JSON.stringify({ sql }),
    });

    if (!dbRes.ok) {
      const text = await dbRes.text();
      console.error('DB auth error response:', dbRes.status, text);
      return NextResponse.json(
        { error: `Database auth failed: ${dbRes.status}: ${text || 'no body'}` },
        { status: 500 },
      );
    }

    const raw = await dbRes.json();

    // The dbapi.iamdeveloper.xyz API returns { message, rows_affected }
    // for DML and COUNT(*) queries. Prefer rows_affected when present.
    if (raw && typeof (raw as any).rows_affected !== 'undefined') {
      const affected = Number((raw as any).rows_affected);
      if (!affected) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
    } else {
      let rows: any[] = [];
      if (Array.isArray(raw)) {
        rows = raw;
      } else if (raw && Array.isArray((raw as any).rows)) {
        rows = (raw as any).rows;
      }

      const first = rows[0] as any;
      const count = first ? Number(first.cnt ?? first.count) : 0;
      if (!count) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
    }

    const maxAgeEnv = process.env.APP_SESSION_MAX_AGE;
    const maxAge = maxAgeEnv ? parseInt(maxAgeEnv, 10) || 1800 : 1800; // default 30 minutes

    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: 'app_session',
      value: '1',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
    return res;
  } catch (e) {
    console.error('Login error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Login failed' },
      { status: 500 },
    );
  }
}

