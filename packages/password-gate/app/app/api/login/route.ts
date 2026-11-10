import { NextResponse, type NextRequest } from 'next/server';
import { auth, safeNext } from '@/lib/auth';

// relative Location: the browser stays on whatever host it came from
const seeOther = (to: string) => new NextResponse(null, { status: 303, headers: { Location: to } });

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const next = safeNext(form.get('next'));
  const ok = await auth.checkPassword(String(form.get('password') ?? ''));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    const q = new URLSearchParams({ error: '1' });
    if (next !== '/') q.set('next', next);
    return seeOther('/login?' + q);
  }
  const res = seeOther(next);
  res.cookies.set(auth.cookie, await auth.makeToken(), {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: auth.maxAge,
  });
  return res;
}
