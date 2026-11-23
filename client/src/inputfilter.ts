// Filter input otomatis untuk SEMUA form (login, pendaftaran, portal ormas, admin, pencarian, dll).
// Saat mengetik atau menempel, karakter yang berbahaya atau tidak sesuai jenis isian langsung dibuang di browser,
// sehingga tag HTML/skrip (<, >) dan karakter kontrol tidak pernah terkirim ke server lewat AJAX/fetch.
// Pemeriksaan di server tetap berjalan sebagai lapisan kedua. Isian password tidak pernah diubah.
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;       // karakter kontrol (selain tab dan baris baru)
const CTRL_ALL = /[\u0000-\u001f\u007f]/g;                             // untuk isian satu baris
const TAGS = /[<>]/g;

type Fn = (v: string) => string;

function labelOf(el: HTMLInputElement | HTMLTextAreaElement): string {
  if (!el.id) return '';
  try { return document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent || ''; } catch { return ''; }
}

// Aturan filter menurut jenis isian; null = jangan diubah
function ruleFor(el: HTMLInputElement | HTMLTextAreaElement): Fn | null {
  const key = `${el.id} ${el.name}`.toLowerCase();
  if (/pass|sandi/i.test(`${key} ${el.autocomplete} ${labelOf(el)}`)) return null; // password (juga saat ditampilkan sebagai teks)
  if (el instanceof HTMLTextAreaElement) return (v) => v.replace(CTRL, '').replace(TAGS, '');
  const t = el.type;
  if (['password', 'file', 'checkbox', 'radio', 'date', 'number', 'range', 'color', 'hidden', 'submit', 'button'].includes(t)) return null;
  if (t === 'email') return (v) => v.replace(/[\s<>"'`,;()\\]/g, '');
  if (t === 'tel') return (v) => v.replace(/[^0-9+\-\s()]/g, '');
  if (t === 'url' || /^link_/.test(el.id)) return (v) => v.replace(/[\s<>"'`\\]/g, '');
  if (/username/i.test(el.autocomplete) || /(^|[^a-z])username([^a-z]|$)/.test(key)) return (v) => v.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 30);
  if (/tahun/.test(key)) return (v) => v.replace(/\D/g, '').slice(0, 4);
  return (v) => v.replace(CTRL_ALL, '').replace(TAGS, ''); // teks biasa dan kolom pencarian
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, v: string) {
  // setter asli (bukan yang dibungkus React) agar React membaca nilai yang sudah difilter pada onChange
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, v);
}

if (typeof document !== 'undefined') {
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || (e as InputEvent).isComposing) return;
    const rule = ruleFor(el);
    if (!rule) return;
    const before = el.value, after = rule(before);
    if (after === before) return;
    let pos: number | null = null;
    try { pos = el.selectionStart; } catch { pos = null; }
    setValue(el, after);
    if (pos != null) { try { const p = rule(before.slice(0, pos)).length; el.setSelectionRange(p, p); } catch { /* tipe isian tanpa kursor */ } }
  }, true);
}
