// Fitur tambahan SIDOMAS:
//  - tanggal berlaku SKTO / legal standing -> peringatan mendekati kedaluwarsa + daftar dokumen kedaluwarsa
//  - notifikasi admin (lonceng + titik merah, bisa ditandai sudah dibaca) dan notifikasi HP (Web Push)
//  - pengecekan sesi akses PDF ormas (berakhir seketika jika admin mengganti password harian)
import jwt from 'jsonwebtoken';
import { db, SECRET, getSetting, setSetting } from './db.js';

const now = () => new Date().toISOString();
const todayJkt = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
export const SEGERA = 90; // hari: dokumen dianggap "mendekati kedaluwarsa"

// ---------- Tanggal berlaku (teks bebas atau tanggal) ----------
const BULAN = {
  januari: 1, jan: 1, februari: 2, pebruari: 2, feb: 2, maret: 3, mar: 3, april: 4, apr: 4, mei: 5, juni: 6, jun: 6, juli: 7, jul: 7,
  agustus: 8, agu: 8, agt: 8, ags: 8, september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, november: 11, nopember: 11, nov: 11, desember: 12, des: 12,
};
const pad = (n) => String(n).padStart(2, '0');
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const valid = (y, m, d) => (y >= 1990 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= lastDay(y, m) ? { tgl: `${y}-${pad(m)}-${pad(d)}` } : { tidakTerbaca: true });

// Mengubah isian "Berlaku s/d" menjadi tanggal. Format yang dikenali: 2026-12-31, 31/12/2026, 31 Desember 2026,
// Desember 2026 (akhir bulan), dan 2026 saja (dianggap berakhir 31 Desember tahun itu). "Seumur hidup" = tanpa batas.
export function parseBerlaku(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return { kosong: true };
  if (/seumur\s*hidup|selamanya|tidak\s*terbatas|tanpa\s*batas|permanen/.test(s)) return { seumurHidup: true };
  let m;
  if ((m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) return valid(+m[1], +m[2], +m[3]);
  if ((m = s.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/))) return valid(+m[3], +m[2], +m[1]);
  if ((m = s.match(/(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})/)) && BULAN[m[2]]) return valid(+m[3], BULAN[m[2]], +m[1]);
  if ((m = s.match(/([a-z]+)\.?\s+(\d{4})/)) && BULAN[m[1]]) return valid(+m[2], BULAN[m[1]], lastDay(+m[2], BULAN[m[1]]));
  if ((m = s.match(/\b((?:19|20)\d{2})\b/))) return valid(+m[1], 12, 31);
  return { tidakTerbaca: true };
}
const selisihHari = (tgl) => {
  const [y, m, d] = tgl.split('-').map(Number), [ty, tm, td] = todayJkt().split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
};
export const tglIndo = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });

const satu = (val) => {
  const p = parseBerlaku(val);
  if (p.tgl) { const hari = selisihHari(p.tgl); return { tgl: p.tgl, hari, status: hari < 0 ? 'kedaluwarsa' : hari <= SEGERA ? 'segera' : 'aman' }; }
  return { status: p.kosong ? 'kosong' : p.seumurHidup ? 'seumur_hidup' : 'tidak_terbaca' };
};
export const expiryInfo = (o) => ({ skto: satu(o.skto_berlaku_sd), legal: satu(o.legal_berlaku_sd) });
export const withExpiry = (r) => ({ ...r, items: r.items.map((o) => ({ ...o, exp: expiryInfo(o) })) });

// Daftar dokumen (SKTO dan legal standing) yang sudah kedaluwarsa atau akan berakhir dalam `window` hari.
export function dokKedaluwarsa(window = SEGERA) {
  const rows = db.prepare('select o.id,o.kode_ormas,o.nama_ormas,o.status_operasional,o.skto_nomor,o.skto_berlaku_sd,o.nomor_sk,o.legal_jenis,o.legal_berlaku_sd,k.nama_kategori from ormas o join kategori k on k.id=o.kategori_id order by o.id').all();
  const items = [], tidak_terbaca = [];
  for (const o of rows) {
    for (const [jenis, nomor, nilai] of [['SKTO', o.skto_nomor, o.skto_berlaku_sd], ['Legal Standing', [o.legal_jenis, o.nomor_sk].filter(Boolean).join(' '), o.legal_berlaku_sd]]) {
      const e = satu(nilai);
      if (e.tgl && e.hari <= window) items.push({ id: o.id, kode_ormas: o.kode_ormas, nama_ormas: o.nama_ormas, nama_kategori: o.nama_kategori, status_operasional: o.status_operasional, jenis, nomor, berlaku_sd: e.tgl, hari: e.hari, status: e.status });
      else if (e.status === 'tidak_terbaca') tidak_terbaca.push({ id: o.id, kode_ormas: o.kode_ormas, nama_ormas: o.nama_ormas, jenis, nilai });
    }
  }
  items.sort((a, b) => a.hari - b.hari);
  return { window, items, sudah: items.filter((i) => i.hari < 0).length, segera: items.filter((i) => i.hari >= 0).length, tidak_terbaca };
}

// ---------- Notifikasi HP (Web Push) ----------
let wp = null, wpSiap = false;
async function getWebPush() {
  if (wpSiap) return wp;
  wpSiap = true;
  try {
    const mod = await import('web-push');
    wp = mod.default || mod;
    let pub = getSetting('vapid_public'), priv = getSetting('vapid_private');
    if (!pub || !priv) { const k = wp.generateVAPIDKeys(); pub = k.publicKey; priv = k.privateKey; setSetting('vapid_public', pub); setSetting('vapid_private', priv); }
    const subject = process.env.VAPID_SUBJECT || (/^https:\/\//.test(process.env.APP_URL || '') ? process.env.APP_URL : 'mailto:admin@sidomas.local');
    wp.setVapidDetails(subject, pub, priv);
  } catch (e) { console.error('Notifikasi HP (Web Push) tidak aktif:', e.message); wp = null; }
  return wp;
}
// except: admin yang tidak ikut dikirimi (pelaku perubahan); only: hanya admin itu (uji coba)
async function kirimPush(payload, { except = null, only = null } = {}) {
  const w = await getWebPush();
  if (!w) return;
  const subs = db.prepare(`select s.* from push_langganan s join admin a on a.id=s.admin_id where a.status_akun='aktif'`).all()
    .filter((s) => (only ? s.admin_id === only : s.admin_id !== except));
  await Promise.all(subs.map(async (s) => {
    try { await w.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 86400 }); }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) db.prepare('delete from push_langganan where id=?').run(s.id); // perangkat sudah mencabut izin
      else console.error('Kirim notifikasi HP gagal:', e.statusCode || e.message);
    }
  }));
}

// Membuat notifikasi untuk semua admin. Pelaku perubahan otomatis dianggap sudah membaca dan tidak dikirimi notifikasi HP.
export function notify({ jenis, judul, pesan, ormasId = null, actor = null, kunci = null, push = true }) {
  try {
    const id = db.prepare('insert into notifikasi(jenis,judul,pesan,ormas_id,kunci,created_at) values(?,?,?,?,?,?)').run(jenis, judul, pesan, ormasId, kunci, now()).lastInsertRowid;
    if (actor?.id) db.prepare('insert or ignore into notifikasi_baca(notif_id,admin_id) values(?,?)').run(id, actor.id);
    if (push) kirimPush({ title: 'SIDOMAS', body: pesan, url: '/admin/notifikasi', tag: 'n' + id }, { except: actor?.id ?? null }).catch(() => {});
    return id;
  } catch (e) {
    if (!String(e.message).includes('UNIQUE')) console.error('Gagal membuat notifikasi:', e.message);
    return null; // pengingat dengan kunci yang sama sudah pernah dibuat
  }
}

// Pengingat otomatis: SKTO / legal standing yang akan berakhir dalam 30 hari atau sudah lewat.
export function cekKedaluwarsa() {
  try {
    let baru = 0;
    for (const it of dokKedaluwarsa(30).items) {
      const lewat = it.hari < 0;
      const pesan = `${it.jenis} ${it.nama_ormas} (${it.kode_ormas}) ${lewat ? `sudah kedaluwarsa sejak ${tglIndo(it.berlaku_sd)}` : it.hari === 0 ? `berakhir hari ini (${tglIndo(it.berlaku_sd)})` : `berakhir ${tglIndo(it.berlaku_sd)} (${it.hari} hari lagi)`}. Mohon diperbarui.`;
      if (notify({ jenis: 'kedaluwarsa', judul: `${it.jenis} ${it.kode_ormas} ${lewat ? 'sudah kedaluwarsa' : 'segera berakhir'}`, pesan, ormasId: it.id, kunci: `exp:${it.id}:${it.jenis}:${it.berlaku_sd}:${lewat ? 'lewat' : '30'}`, push: false })) baru++;
    }
    if (baru) kirimPush({ title: 'SIDOMAS', body: `${baru} dokumen ormas sudah atau hampir kedaluwarsa, CEK SELENGKAPNYA!`, url: '/admin/kedaluwarsa', tag: 'kedaluwarsa' }).catch(() => {});
  } catch (e) { console.error('Pengecekan kedaluwarsa gagal:', e.message); }
}

// ---------- Sesi akses PDF ormas ----------
// Token akses PDF hanya sah selama kredensial harian yang dipakai masih aktif. Begitu admin membuat ulang password harian
// (atau hari berganti), sesi ormas langsung tidak sah.
export function sessionAktif(p) {
  if (!p?.cid || !p?.k) return false;
  return !!db.prepare(`select 1 from kredensial_harian c join ormas o on o.id=c.ormas_id where c.id=? and c.status='aktif' and c.tanggal_berlaku=? and o.kode_ormas=? and o.status_publikasi='Publik'`).get(p.cid, todayJkt(), p.k);
}

// ---------- Rute ----------
export function setupFitur({ app, auth }) {
  // Notifikasi lonceng
  app.get('/api/admin/notifikasi', auth(null), (req, res) => {
    const a = req.admin.id;
    const items = db.prepare('select n.*,o.kode_ormas,(b.admin_id is not null) as dibaca from notifikasi n left join ormas o on o.id=n.ormas_id left join notifikasi_baca b on b.notif_id=n.id and b.admin_id=? order by n.id desc limit 60').all(a);
    const unread = db.prepare('select count(*) c from notifikasi n where not exists (select 1 from notifikasi_baca b where b.notif_id=n.id and b.admin_id=?)').get(a).c;
    res.json({ items: items.map((i) => ({ ...i, dibaca: !!i.dibaca })), unread });
  });
  app.get('/api/admin/notifikasi/unread', auth(null), (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ unread: db.prepare('select count(*) c from notifikasi n where not exists (select 1 from notifikasi_baca b where b.notif_id=n.id and b.admin_id=?)').get(req.admin.id).c });
  });
  app.post('/api/admin/notifikasi/read-all', auth(null), (req, res) => {
    db.prepare('insert or ignore into notifikasi_baca(notif_id,admin_id) select id,? from notifikasi').run(req.admin.id);
    res.json({ ok: true });
  });
  app.post('/api/admin/notifikasi/:id/read', auth(null), (req, res) => {
    const id = +req.params.id;
    if (db.prepare('select 1 from notifikasi where id=?').get(id)) db.prepare('insert or ignore into notifikasi_baca(notif_id,admin_id) values(?,?)').run(id, req.admin.id);
    res.json({ ok: true });
  });

  // Notifikasi HP (Web Push)
  app.get('/api/admin/push/key', auth(null), async (req, res) => {
    const w = await getWebPush();
    if (!w) return res.status(503).json({ error: 'Notifikasi HP belum tersedia di server ini' });
    res.json({ key: getSetting('vapid_public') });
  });
  app.post('/api/admin/push/subscribe', auth(null), (req, res) => {
    const s = req.body || {}, endpoint = String(s.endpoint || ''), p256dh = String(s.keys?.p256dh || ''), authKey = String(s.keys?.auth || '');
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 800 || !p256dh || !authKey) return res.status(400).json({ error: 'Data langganan tidak valid' });
    db.prepare('insert into push_langganan(admin_id,endpoint,p256dh,auth,created_at) values(?,?,?,?,?) on conflict(endpoint) do update set admin_id=excluded.admin_id,p256dh=excluded.p256dh,auth=excluded.auth').run(req.admin.id, endpoint, p256dh, authKey, now());
    res.json({ ok: true });
  });
  app.post('/api/admin/push/unsubscribe', auth(null), (req, res) => {
    db.prepare('delete from push_langganan where endpoint=? and admin_id=?').run(String(req.body?.endpoint || ''), req.admin.id);
    res.json({ ok: true });
  });
  app.post('/api/admin/push/test', auth(null), async (req, res) => {
    await kirimPush({ title: 'SIDOMAS', body: `Notifikasi uji coba untuk ${req.admin.username}: notifikasi HP sudah aktif.`, url: '/admin/notifikasi', tag: 'uji' }, { only: req.admin.id });
    res.json({ ok: true });
  });

  // Dokumen kedaluwarsa / mendekati kedaluwarsa
  app.get('/api/admin/kedaluwarsa', auth('view_ormas'), (req, res) => res.json(dokKedaluwarsa([30, 60, 90, 180, 365].includes(+req.query.hari) ? +req.query.hari : SEGERA)));

  // Dicek berkala oleh halaman publik selama PDF terbuka
  app.get('/api/public/session', (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const p = jwt.verify(String(req.query.token || ''), SECRET);
      if (p.scope !== 'doc' || !sessionAktif(p)) throw new Error('habis');
      res.json({ ok: true });
    } catch { res.status(401).json({ error: 'SESI_HABIS' }); }
  });
}
