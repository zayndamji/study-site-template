import { NextResponse, type NextRequest } from 'next/server';
import { auth } from './lib/auth';

// Every request passes through here, including the site's static files in public/.
// URLs are built with new URL(): NextURL (req.nextUrl.clone()) re-adds a trailing slash it saw on
// the way in, which loops. A proxy can't return a relative Location ("Invalid URL"); the login
// route handler can, and does.
const OPEN = new Set(['/login', '/api/login']);

export async function proxy(req: NextRequest) {
  const { pathname, search } = new URL(req.url);
  if (OPEN.has(pathname) || pathname.startsWith('/_next/')) return NextResponse.next();

  if (!(await auth.verifyToken(req.cookies.get(auth.cookie)?.value))) {
    const to = pathname === '/' ? '/login' : '/login?' + new URLSearchParams({ next: pathname + search });
    return NextResponse.redirect(new URL(to, req.url), 307);
  }
  // the site's home page (and any folder) is its index.html
  if (pathname.endsWith('/')) return NextResponse.rewrite(new URL(pathname + 'index.html' + search, req.url));
  return NextResponse.next();
}

export const config = {
  // everything except Next's own build assets (the login page's CSS/JS, which hold no site content)
  matcher: ['/((?!_next/static|_next/image).*)'],
};
