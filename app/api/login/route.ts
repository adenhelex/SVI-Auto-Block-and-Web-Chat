import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password.trim() : '';

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const expectedUser = process.env.APP_LOGIN_USER || 'admin';
    const expectedPass = process.env.APP_LOGIN_PASSWORD || 'changeme';
    if (username !== expectedUser || password !== expectedPass) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
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

