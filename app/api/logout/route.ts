import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  // Clear the session cookie so middleware will force re-login
  res.cookies.set({
    name: 'app_session',
    value: '',
    path: '/',
    maxAge: 0,
  });
  return res;
}

