// Filter input (sisi browser): sama dengan server/inputFilter.js, memberi umpan balik cepat sebelum data dikirim. Penegakan utama tetap di server.
// Isi kolom password/token tidak diperiksa.
const SKIP = /pass|sandi|token|secret/i;

export const BAD: [RegExp, string][] = [
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
export function findBad(obj: any, key = '', depth = 0): { key: string; why: string } | null {
  if (obj == null || depth > 4) return null;
  if (typeof obj === 'string') {
    if (SKIP.test(key)) return null;
    for (const [re, why] of BAD) if (re.test(obj)) return { key: key || 'input', why };
    return null;
  }
  if (typeof obj !== 'object') return null;
  for (const k of Object.keys(obj)) {
    const hit = findBad(obj[k], Array.isArray(obj) ? key : k, depth + 1);
    if (hit) return hit;
  }
  return null;
}
