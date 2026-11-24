// Penguatan keamanan: batas koneksi realtime, pencabutan token sesi, aturan password, dan pembatasan pesan WhatsApp.
import crypto from 'crypto';

export const LIVE_MAX = 300, LIVE_PER_IP = 10; // batas koneksi realtime: total dan per alamat IP
export const PW_MSG = 'Password minimal 10 karakter, harus mengandung huruf besar, huruf kecil, dan angka, serta tidak boleh memuat username/email atau pola umum (mis. "password", "12345")';

const WEAK = ['password', 'passw0rd', 'qwerty', 'admin', 'sidomas', 'welcome', 'letmein', 'iloveyou', 'ormas', 'kesbang', 'poldagri'];
const SEQ = /(0123|1234|2345|3456|4567|5678|6789|7890|abcd|bcde|cdef|qwer|wert|asdf|zxcv)/i;

// null = password sah; selain itu pesan kesalahan. ctx = teks yang tidak boleh terkandung di password (username, email, dll).
export function passwordError(p, ctx = []) {
  if (typeof p !== 'string' || p.length < 10 || p.length > 100) return PW_MSG;
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/\d/.test(p)) return PW_MSG;
  const low = p.toLowerCase();
  if (/(.)\1{3,}/.test(p) || SEQ.test(p) || WEAK.some((w) => low.includes(w))) return PW_MSG;
  for (const c of ctx) { const t = String(c || '').toLowerCase().split('@')[0]; if (t.length >= 3 && low.includes(t)) return PW_MSG; }
  return null;
}

export function createHardening({ db, jwt, secret }) {
  db.exec(`create table if not exists token_dicabut(jti text primary key, exp integer not null);
create table if not exists wa_terkirim(nomor_hash text primary key, waktu integer not null);`);
  const nowS = () => Math.floor(Date.now() / 1000);
  const WA_DAILY_MAX = +process.env.WA_DAILY_MAX || 100;
  return {
    newJti: () => crypto.randomBytes(16).toString('hex'),
    pvOf: (hash) => String(hash || '').slice(-16), // berubah saat password berubah, sehingga sesi lama otomatis tidak sah
    // Cabut token sesi (dipakai saat logout); catatan dibersihkan otomatis setelah token kedaluwarsa
    revoke(token) {
      try { const p = jwt.verify(String(token || ''), secret); if (p.jti) db.prepare('insert or ignore into token_dicabut(jti,exp) values(?,?)').run(p.jti, p.exp); } catch { /* token sudah tidak sah */ }
    },
    // true jika token dicabut ATAU tidak punya identitas (token lama sebelum pembaruan ini: wajib login ulang)
    isRevoked: (jti) => !jti || !!db.prepare('select 1 from token_dicabut where jti=?').get(jti),
    purge() {
      const t = nowS();
      db.prepare('delete from token_dicabut where exp<?').run(t);
      db.prepare('delete from wa_terkirim where waktu<?').run(t - 2 * 86400);
    },
    // Koneksi realtime: total maksimal LIVE_MAX dan LIVE_PER_IP per IP
    liveAllow(req, clients) {
      if (clients.size >= LIVE_MAX) return false;
      let n = 0;
      for (const r of clients) if (r.liveIp === req.ip && ++n >= LIVE_PER_IP) return false;
      return true;
    },
    // WhatsApp: satu nomor hanya menerima satu pesan per 24 jam, dan total pesan per hari dibatasi (WA_DAILY_MAX, bawaan 100)
    waAllow(nomor) {
      const h = crypto.createHash('sha256').update(String(nomor)).digest('hex'), t = nowS();
      const last = db.prepare('select waktu from wa_terkirim where nomor_hash=?').get(h);
      if (last && t - last.waktu < 86400) return false;
      if (db.prepare('select count(*) c from wa_terkirim where waktu>?').get(t - 86400).c >= WA_DAILY_MAX) return false;
      db.prepare('insert into wa_terkirim(nomor_hash,waktu) values(?,?) on conflict(nomor_hash) do update set waktu=excluded.waktu').run(h, t);
      return true;
    },
  };
}
