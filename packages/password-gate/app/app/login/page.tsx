import { auth, safeNext } from '@/lib/auth';

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const t = auth.labels;
  return (
    <main className="card">
      <h1>{auth.title}</h1>
      <p className="muted">{t.intro}</p>
      <form method="post" action="/api/login">
        <input type="hidden" name="next" value={safeNext(next)} />
        <label htmlFor="password">{t.password}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        {error ? <p className="error" role="alert">{t.wrong}</p> : null}
        <button type="submit">{t.submit}</button>
      </form>
    </main>
  );
}
