import { findBad } from './inputfilter';
export interface ApiError extends Error { status: number; code?: string }
export async function api<T = any>(path: string, opts: { method?: string; body?: any; form?: FormData } = {}): Promise<T> {
  // Filter input di browser: tolak pola XSS / SQL injection sebelum dikirim
  let hit: ReturnType<typeof findBad> = null;
  if (opts.form) { for (const [k, v] of opts.form.entries()) if (typeof v === 'string' && (hit = findBad(v, k))) break; }
  else hit = findBad(opts.body);
  if (!hit && path.includes('?')) { const q: Record<string, string> = {}; new URLSearchParams(path.split('?')[1]).forEach((v, k) => { q[k] = v; }); hit = findBad(q); }
  if (hit) throw Object.assign(new Error(`Input pada kolom "${hit.key}" ditolak karena mengandung ${hit.why} yang tidak diperbolehkan. Hapus karakter tersebut lalu coba lagi.`), { status: 400 }) as ApiError;
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
