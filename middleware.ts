import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Paths that don't require login
const PUBLIC_PATHS = ['/login', '/api/login', '/_next', '/favicon.ico'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow Next.js assets and favicon
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  // Allow login routes
  if (pathname === '/login' || pathname.startsWith('/api/login')) {
    return NextResponse.next();
  }

  const session = req.cookies.get('app_session');
  if (!session) {
    const loginUrl = new URL('/login', req.url);
    // Remember where the user was going
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

