// Filter input: menolak pola XSS dan SQL injection pada SEMUA form (JSON, multipart, dan query string).
// Isi kolom password/token tidak diperiksa dan tidak diubah. Karakter kontrol tak terlihat dibuang otomatis.
const SKIP = /pass|sandi|token|secret/i;
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
export const BAD = [
  [/<\s*\/?\s*[a-z][^>]*>/i, 'tag HTML'],
  [/<\s*(script|iframe|object|embed|svg|img|link|meta|style)\b/i, 'tag HTML/script'],
  [/\bon[a-z]{3,20}\s*=/i, 'event handler script'],
  [/(java|vb)script\s*:/i, 'protokol script'],
  [/data\s*:\s*text\/html/i, 'data HTML'],
  [/\bunion\b[\s\S]{0,20}\bselect\b/i, 'perintah SQL'],
  [/;\s*(drop|delete|insert|update|alter|create|truncate|exec|attach|pragma)\b/i, 'perintah SQL'],
  [/['"`]\s*(or|and)\b[\s\S]{0,30}=/i, 'pola SQL injection'],
  [/\b(or|and)\s+(\d+|'[^']*'|"[^"]*")\s*=\s*(\d+|'[^']*'|"[^"]*")/i, 'pola SQL injection'],
  [/['"`]\s*(--|#|\/\*)/, 'komentar SQL'],
  [/\/\*[\s\S]*?\*\//, 'komentar SQL'],
  [/\bselect\b[\s\S]{1,80}\bfrom\b/i, 'perintah SQL'],
  [/\b(sleep|benchmark|randomblob|load_extension)\s*\(/i, 'fungsi SQL'],
  [/\b(information_schema|sqlite_master|sqlite_schema|xp_cmdshell)\b/i, 'perintah SQL'],
];
export function findBad(obj, key = '', depth = 0) {
  if (obj == null || depth > 4) return null;
  if (typeof obj === 'string') {
    if (SKIP.test(key)) return null;
    for (const [re, why] of BAD) if (re.test(obj)) return { key: key || 'input', why };
    return null;
  }
  if (typeof obj !== 'object') return null;
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === 'string' && !SKIP.test(k)) obj[k] = obj[k].replace(CTRL, '');
    const hit = findBad(obj[k], Array.isArray(obj) ? key : k, depth + 1);
    if (hit) return hit;
  }
  return null;
}
