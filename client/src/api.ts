export interface ApiError extends Error { status: number; code?: string }
export async function api<T = any>(path: string, opts: { method?: string; body?: any; form?: FormData } = {}): Promise<T> {
  const r = await fetch('/api' + path, {
    method: opts.method || (opts.body || opts.form ? 'POST' : 'GET'),
    credentials: 'include',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.form || (opts.body ? JSON.stringify(opts.body) : undefined),
  });
  const data = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
  if (!r.ok) throw Object.assign(new Error(data?.error || 'Terjadi kesalahan, coba lagi'), { status: r.status, code: data?.error }) as ApiError;
  return data as T;
}
