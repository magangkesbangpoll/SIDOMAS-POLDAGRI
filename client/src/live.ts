// Pembaruan realtime: server mengirim sinyal "tick" lewat SSE setiap ada perubahan data.
type Fn = () => void;
const subs = new Set<Fn>();
let es: EventSource | null = null, timer: any = null, opened = false;
const fire = () => { clearTimeout(timer); timer = setTimeout(() => subs.forEach((f) => f()), 250); };
function start() {
  if (es || typeof EventSource === 'undefined') return;
  es = new EventSource('/api/live');
  es.addEventListener('tick', fire);
  es.onopen = () => { if (opened) fire(); opened = true; }; // sambung ulang: segarkan data
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && fire());
}
export function onLive(fn: Fn) { subs.add(fn); start(); return () => { subs.delete(fn); }; }
