
import ExcelJS from 'exceljs';
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import dns from 'dns';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, DATA_DIR, SECRET, PERMS, getSetting as S, setSetting } from './db.js';
import { driveOn, driveUpload, driveDownload, driveDelete, driveOrganize, driveDeleteFolder } from './drive.js';
import { backupDb } from './backup.js';
import { setupFitur, notify, withExpiry, expiryInfo, dokKedaluwarsa, sessionAktif, cekKedaluwarsa } from './fitur.js';
import { createHardening, passwordError, PW_MSG } from './hardening.js';

try { dns.setDefaultResultOrder?.('ipv4first'); } catch {} // jaringan dengan IPv6 bermasalah tidak membuat koneksi ke Gmail/Drive macet

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Jalankan fn; jika gagal karena gangguan jaringan sesaat, coba lagi dengan jeda (ms) pada daftar `jeda`.
const retry = async (fn, jeda = [1500, 4000]) => {
  let err;
  for (let i = 0; i <= jeda.length; i++) {
    try { return await fn(i); } catch (e) { err = e; if (i < jeda.length) await new Promise((r) => setTimeout(r, jeda[i])); }
  }
  throw err;
};
// Server tidak boleh mati hanya karena satu proses latar belakang (email/Drive/backup) gagal
process.on('unhandledRejection', (e) => console.error('Kesalahan latar belakang (diabaikan):', e?.message || e));
// Penguatan keamanan: batas koneksi realtime, pencabutan token sesi, aturan password, batas WhatsApp (lihat hardening.js)
const hd = createHardening({ db, jwt, secret: SECRET });
const PORT = +process.env.PORT || 3001;
const now = () => new Date().toISOString();
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
// Lima dokumen wajib + laporan kegiatan tahunan (opsional; kunci internal tetap 'dokumentasi')
const DOC_TYPES = { sk_pengurusan: 'SK Pengurusan', surat_domisili: 'Surat Keterangan Domisili', program_kerja: 'Program Kerja', badan_hukum: 'Salinan Badan Hukum', skto: 'SKTO', dokumentasi: 'Laporan Kegiatan Tahunan', adart: 'AD/ART', company_profile: 'Company Profile' };
// Dokumen opsional: laporan tahunan, AD/ART (terkunci seperti PDF lain), dan Company Profile (PDF/PPT/PPTX, TERBUKA untuk publik)
const OPT_DOCS = ['dokumentasi', 'adart', 'company_profile'];
const REQ_DOCS = Object.keys(DOC_TYPES).filter((k) => !OPT_DOCS.includes(k));
const PPT_MIME = ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
const docMime = (jenis, nama) => (jenis !== 'company_profile' ? 'application/pdf' : /\.pptx$/i.test(nama) ? PPT_MIME[1] : /\.ppt$/i.test(nama) ? PPT_MIME[0] : 'application/pdf');
const klas = (jenis) => (jenis === 'company_profile' ? 'publik' : 'kredensial');
const VALIDASI = ['Terdata', 'Terdaftar', 'Teregister'];
const INT_FIELDS = ['anggota_perempuan', 'anggota_lansia', 'anggota_disabilitas', 'anggota_total'];
const urlOk = (v) => { try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } };
// Instagram: boleh berupa tautan lengkap, @username, atau username saja
const igUrl = (v) => {
  v = String(v || '').trim();
  if (!v || /^https?:\/\//i.test(v)) return v;
  const u = v.replace(/^@/, '').replace(/^(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(u) ? `https://www.instagram.com/${u}/` : v;
};
const KEMANTREN = ['Danurejan', 'Gedongtengen', 'Gondokusuman', 'Gondomanan', 'Jetis', 'Kotagede', 'Kraton', 'Mantrijeron', 'Mergangsan', 'Ngampilan', 'Pakualaman', 'Tegalrejo', 'Umbulharjo', 'Wirobrajan'];
const DOC_ST = ['Lengkap', 'Belum Lengkap', 'Perlu Diverifikasi', 'Tidak Berlaku', 'Kedaluwarsa'];
const OPS_ST = ['Aktif', 'Tidak Aktif'];
const PUB_ST = ['Publik', 'Disembunyikan'];
const FILES = path.join(DATA_DIR, 'files');
const LOGOS = path.join(DATA_DIR, 'logos');
const PENDING = path.join(DATA_DIR, 'pending'); // berkas kiriman ormas yang menunggu verifikasi (belum ke katalog/Google Drive)

// ---------- Kripto & kredensial harian ----------
const ENC_KEY = crypto.createHash('sha256').update(SECRET + ':enc').digest();
const enc = (t) => { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv); const b = Buffer.concat([c.update(t, 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), b]).toString('base64'); };
const dec = (s) => { const b = Buffer.from(s, 'base64'); const d = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); };
const ALPHA = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
const rnd = (n) => Array.from({ length: n }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join('');
const DUMMY_HASH = bcrypt.hashSync('dummy', 8);

function makeCred(ormasId, t = today()) {
  const username = 'u' + rnd(7).toLowerCase(), password = rnd(10);
  db.transaction(() => {
    db.prepare(`update kredensial_harian set status='diganti' where ormas_id=? and status='aktif'`).run(ormasId);
    db.prepare(`insert into kredensial_harian(ormas_id,username,password_hash,password_enc,tanggal_berlaku,tanggal_kedaluwarsa,created_at,status) values(?,?,?,?,?,?,?,'aktif')`)
      .run(ormasId, username, bcrypt.hashSync(password, 8), enc(password), t, new Date(`${t}T23:59:59+07:00`).toISOString(), now());
  })();
}
// Lazy rotation + scheduler: kredensial hari ini dibuat otomatis untuk semua ormas
function ensureAll() {
  const t = today();
  db.prepare(`update kredensial_harian set status='kedaluwarsa' where status='aktif' and tanggal_berlaku<?`).run(t);
  for (const m of db.prepare(`select id from ormas where id not in (select ormas_id from kredensial_harian where tanggal_berlaku=? and status='aktif')`).all(t)) makeCred(m.id, t);
}
function ensureOne(id) {
  const t = today();
  db.prepare(`update kredensial_harian set status='kedaluwarsa' where status='aktif' and tanggal_berlaku<?`).run(t);
  if (!db.prepare(`select 1 from kredensial_harian where ormas_id=? and tanggal_berlaku=? and status='aktif'`).get(id, t)) makeCred(id, t);
}

// ---------- Log ----------
function log(req, jenis, ormasId, ringkasan, hasil = 'berhasil', who) {
  const a = who || req?.admin;
  db.prepare('insert into log_aktivitas(admin_id,nama_pengguna,role,jenis_aktivitas,ormas_id,ringkasan,waktu_aktivitas,hasil) values(?,?,?,?,?,?,?,?)')
    .run(a?.id ?? null, a?.username ?? 'pengunjung', a?.nama_role ?? '-', jenis, ormasId ?? null, String(ringkasan).slice(0, 300), now(), hasil);
}
// Notifikasi untuk admin lain (lonceng + notifikasi HP) setiap kali admin mengubah data
const notifAdmin = (req, judul, ormasId = null) => notify({ jenis: 'admin', judul, pesan: `Admin (${req.admin.username}) Telah Memperbarui, CEK SELENGKAPNYA!`, ormasId, actor: req.admin });

// ---------- Auth ----------
// Token sesi memuat jti (identitas, bisa dicabut saat logout) dan pv (berubah saat password berubah, sehingga sesi lama mati)
function getAdmin(req) {
  try {
    const p = jwt.verify(req.cookies?.sid, SECRET);
    if (hd.isRevoked(p.jti)) return null;
    const a = db.prepare('select a.*, r.nama_role, r.permissions from admin a join roles r on r.id=a.role_id where a.id=?').get(p.id);
    if (!a || a.status_akun !== 'aktif' || p.pv !== hd.pvOf(a.password_hash)) return null;
    a.perms = JSON.parse(a.permissions);
    return a;
  } catch { return null; }
}
const auth = (perm, allowMust = false) => (req, res, next) => {
  const a = getAdmin(req);
  if (!a) return res.status(401).json({ error: 'Sesi tidak valid, silakan login kembali' });
  if (a.must_change && !allowMust) return res.status(403).json({ error: 'GANTI_PASSWORD' });
  if (perm && !a.perms.includes(perm)) return res.status(403).json({ error: 'Anda tidak memiliki izin untuk tindakan ini' });
  req.admin = a; next();
};
// Aturan password: minimal 10 karakter, huruf besar + kecil + angka, tanpa pola umum, dan tidak memuat username/email (ctx)
const validPassword = (p, ctx = []) => passwordError(p, ctx) === null;
function setAdminCookie(res, a) {
  const mins = +S('session_minutes') || 120;
  res.cookie('sid', jwt.sign({ id: a.id, jti: hd.newJti(), pv: hd.pvOf(a.password_hash) }, SECRET, { expiresIn: mins * 60 }), { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', maxAge: mins * 60000 });
}

// ---------- Upload ----------
const magicOk = (f) => {
  const b = Buffer.alloc(12); const fd = fs.openSync(f.path, 'r'); fs.readSync(fd, b, 0, 12, 0); fs.closeSync(fd);
  if (f.fieldname === 'company_profile') return b.subarray(0, 4).toString() === '%PDF' || (b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4) || (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0);
  if (f.fieldname !== 'logo') return b.subarray(0, 4).toString() === '%PDF';
  return (b[0] === 0x89 && b.subarray(1, 4).toString() === 'PNG') || (b[0] === 0xff && b[1] === 0xd8) || (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP');
};
const sniffImg = (p) => { const b = Buffer.alloc(4); const fd = fs.openSync(p, 'r'); fs.readSync(fd, b, 0, 4, 0); fs.closeSync(fd); return b[0] === 0x89 ? 'image/png' : b[0] === 0xff ? 'image/jpeg' : 'image/webp'; };
const allUploaded = (req) => Object.values(req.files || {}).flat();
const isDrive = (k) => String(k || '').startsWith('gd:'); // storage_key 'gd:<id>' = tersimpan di Google Drive
const cleanup = (req) => allUploaded(req).forEach((f) => (isDrive(f.filename) ? driveDelete(f.filename.slice(3)) : fs.rm(f.path, { force: true }, () => {})));
const fail = (req, res, msg, code = 400) => { cleanup(req); return res.status(code).json({ error: msg }); };
const unlink = (dir, key) => key && fs.rm(path.join(dir, path.basename(key)), { force: true }, () => {});
const removeStored = (key, pending = false) => (isDrive(key) ? driveDelete(key.slice(3)) : unlink(pending ? PENDING : FILES, key));
const logoCache = new Map(); // cache logo dari Google Drive agar halaman katalog tetap cepat
const removeLogoFile = (key) => {
  if (!key) return;
  if (isDrive(key)) { logoCache.delete(key.slice(3)); driveDelete(key.slice(3)); } else unlink(LOGOS, key);
};
// Merapikan PDF + logo satu ormas ke folder Drive-nya ("Ormas-001 - Nama Ormas"). Berjalan di latar belakang setelah data tersimpan.
function organizeOrmas(id) {
  if (!driveOn()) return;
  const o = db.prepare('select kode_ormas,nama_ormas,logo_key from ormas where id=?').get(id);
  if (!o) return;
  const ids = [...db.prepare('select storage_key from dokumen_ormas where ormas_id=? and pending=0').all(id).map((r) => r.storage_key), o.logo_key].filter(isDrive).map((k) => k.slice(3));
  if (!ids.length) return;
  driveOrganize(o.kode_ormas, o.nama_ormas, ids).catch((e) => console.error(`Gagal merapikan folder Drive ${o.kode_ormas}:`, e.message));
}
const sniffBuf = (b) => (b[0] === 0x89 ? 'image/png' : b[0] === 0xff ? 'image/jpeg' : 'image/webp');
const cleanName = (n) => Buffer.from(n, 'latin1').toString('utf8').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 150);
const makeUpload = (toPending) => (req, res, next) => {
  const m = multer({
    storage: multer.diskStorage({
      destination: (r, f, cb) => cb(null, toPending ? PENDING : f.fieldname === 'logo' ? LOGOS : FILES),
      filename: (r, f, cb) => cb(null, crypto.randomBytes(16).toString('hex') + (f.fieldname === 'logo' ? '.img' : f.fieldname === 'company_profile' ? '.dat' : '.pdf')), // nama dibuat sistem
    }),
    limits: { fileSize: (+S('max_pdf_mb') || 20) * 1048576, files: 10 },
    fileFilter: (r, f, cb) => {
      const ok = f.fieldname === 'logo' ? /^image\/(png|jpe?g|webp)$/.test(f.mimetype) : f.fieldname === 'company_profile' ? (f.mimetype === 'application/pdf' || PPT_MIME.includes(f.mimetype) || f.mimetype === 'application/octet-stream') && /\.(pdf|pptx?)$/i.test(f.originalname) : !!DOC_TYPES[f.fieldname] && f.mimetype === 'application/pdf';
      cb(ok ? null : new Error('Dokumen harus berformat PDF (Company Profile boleh PPT/PPTX), dan logo PNG/JPG/WEBP'), ok);
    },
  }).fields([{ name: 'logo', maxCount: 1 }, ...Object.keys(DOC_TYPES).map((n) => ({ name: n, maxCount: 1 }))]);
  m(req, res, (err) => {
    if (err) { cleanup(req); return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? `Ukuran file melebihi batas ${S('max_pdf_mb')} MB` : err.message }); }
    const bad = allUploaded(req).find((f) => !magicOk(f));
    if (bad) return fail(req, res, `File "${cleanName(bad.originalname)}" bukan berkas yang valid`);
    next();
  });
};
const upload = makeUpload(false);
const uploadPending = makeUpload(true); // dipakai portal ormas: berkas disimpan lokal dulu sampai admin memverifikasi

// Jika Google Drive diaktifkan (GDRIVE_URL + GDRIVE_SECRET di .env), PDF dan logo dipindahkan dari folder sementara
// ke folder Drive masing-masing. Jika validasi gagal, cleanup() ikut menghapus file di Drive.
const toDrive = async (req, res, next) => {
  if (!driveOn()) return next();
  const files = allUploaded(req);
  const results = await Promise.allSettled(files.map(async (f) => {
    const logo = f.fieldname === 'logo';
    const id = await driveUpload(f.path, `${logo ? 'Logo' : DOC_TYPES[f.fieldname] || f.fieldname} - ${cleanName(f.originalname)}`, { kind: logo ? 'logo' : 'pdf', mime: logo ? f.mimetype : docMime(f.fieldname, f.originalname) });
    f.filename = 'gd:' + id;
    fs.rm(f.path, { force: true }, () => {});
  }));
  const bad = results.find((r) => r.status === 'rejected');
  if (bad) { console.error('Gagal ke Google Drive:', bad.reason?.message); cleanup(req); return res.status(502).json({ error: `Berkas gagal disimpan ke Google Drive: ${bad.reason?.message}` }); }
  next();
};

// ---------- App ----------
const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', +process.env.TRUST_PROXY || process.env.TRUST_PROXY);
// Peta mini di halaman ormas memakai iframe Google Maps, jadi frame-src diizinkan khusus untuk itu
app.use(helmet({ contentSecurityPolicy: { directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), 'frame-src': ["'self'", 'https://www.google.com', 'https://maps.google.com'] } } }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// --- Realtime (Server-Sent Events): beri sinyal ke semua browser tiap ada perubahan data ---
// Dibatasi: maksimal 300 koneksi total dan 10 per alamat IP (lihat hardening.js) agar tidak bisa dipakai menghabiskan sumber daya server
const liveClients = new Set();
const liveBroadcast = () => { for (const r of liveClients) r.write(`event: tick\ndata: ${Date.now()}\n\n`); };
app.get('/api/live', (req, res) => {
  if (!hd.liveAllow(req, liveClients)) return res.status(429).json({ error: 'Terlalu banyak koneksi pembaruan otomatis' });
  res.liveIp = req.ip;
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders(); res.write('retry: 3000\n\n'); liveClients.add(res);
  req.on('close', () => liveClients.delete(res));
});
setInterval(() => { for (const r of liveClients) r.write(': ping\n\n'); }, 25000).unref();
setInterval(liveBroadcast, 60000).unref(); // perubahan berbasis waktu (kedaluwarsa, password harian)
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !/^\/(public|auth)\//.test(req.path)) res.on('finish', () => { if (res.statusCode < 400) liveBroadcast(); });
  next();
});

const limiter = (extra = {}) => rateLimit({ windowMs: 15 * 60 * 1000, limit: () => +S('login_max_attempts') || 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Terlalu banyak percobaan. Silakan coba lagi beberapa menit lagi.' }, ...extra });
const loginLimiter = limiter(), accessLimiter = limiter(), forgotLimiter = limiter({ limit: 5 });

// ===== Publik =====
app.get('/api/public/meta', (req, res) => {
  res.json({
    app_name: S('app_name'), catalog_public: S('catalog_public') === 'true', max_pdf_mb: +S('max_pdf_mb'), max_pdf_count: +S('max_pdf_count'),
    total_public: db.prepare(`select count(*) c from ormas where status_publikasi='Publik'`).get().c,
    categories: db.prepare('select id,nama_kategori,status_aktif from kategori order by urutan,id').all(),
  });
});

const SORTS = { kode: 'o.id', nama: 'o.nama_ormas', ketua: 'o.nama_ketua', sk: 'o.nomor_sk', status: 'o.status_dokumen', kategori: 'k.nama_kategori', updated: 'o.updated_at' };
function listOrmas(q, { pub = false, paginate = true } = {}) {
  const w = [], p = [];
  if (pub) w.push(`o.status_publikasi='Publik'`);
  if (q.q) { const t = `%${q.q}%`; if (pub) { w.push('(o.nama_ormas like ? or o.kode_ormas like ?)'); p.push(t, t); } else { w.push('(o.nama_ormas like ? or o.kode_ormas like ? or o.nama_ketua like ? or o.nomor_sk like ?)'); p.push(t, t, t, t); } }
  if (q.kategori_id) { w.push('o.kategori_id=?'); p.push(+q.kategori_id); }
  if (q.status_dokumen) { w.push('o.status_dokumen=?'); p.push(String(q.status_dokumen)); }
  if (!pub && q.status_operasional) { w.push('o.status_operasional=?'); p.push(String(q.status_operasional)); }
  const where = w.length ? 'where ' + w.join(' and ') : '';
  const order = `order by ${SORTS[q.sort] || 'o.id'} ${q.dir === 'desc' ? 'desc' : 'asc'}, o.id asc`;
  const from = 'from ormas o join kategori k on k.id=o.kategori_id';
  const total = db.prepare(`select count(*) c ${from} ${where}`).get(...p).c;
  const page = Math.max(1, +q.page || 1), size = Math.min(100, Math.max(1, +q.pageSize || 10));
  const cols = pub
    ? 'o.id,o.kode_ormas,o.nama_ormas,o.nama_ketua,o.sekretaris,o.bendahara,o.anggota_total,o.status_dokumen,o.updated_at,(o.logo_key is not null) as has_logo,k.nama_kategori,o.kategori_id'
    : `o.*,(o.logo_key is not null) as has_logo,k.nama_kategori,(select count(distinct d.jenis_dokumen) from dokumen_ormas d where d.ormas_id=o.id and d.jenis_dokumen is not null and d.jenis_dokumen not in ('dokumentasi','adart','company_profile') and d.pending=0) as jumlah_dok,(select count(*) from perubahan_ormas pp where pp.ormas_id=o.id) as has_pending`;
  const items = db.prepare(`select ${cols} ${from} ${where} ${order} ${paginate ? 'limit ? offset ?' : ''}`).all(...p, ...(paginate ? [size, (page - 1) * size] : []));
  return { items, total, page, pageSize: size };
}

app.get('/api/public/ormas', (req, res) => {
  if (S('catalog_public') !== 'true') return res.json({ items: [], total: 0, page: 1, pageSize: 12 });
  res.json(listOrmas({ ...req.query, pageSize: 12 }, { pub: true }));
});

app.get('/api/public/ormas/:kode', (req, res) => {
  const o = db.prepare(`select o.id,o.kode_ormas,o.nama_ormas,o.nama_ketua,o.sekretaris,o.bendahara,o.nomor_whatsapp_ketua,o.email_ormas,o.alamat,o.anggota_perempuan,o.anggota_lansia,o.anggota_disabilitas,o.anggota_total,o.link_dokumentasi,o.link_instagram,o.link_youtube,o.link_tiktok,o.status_dokumen,o.updated_at,(o.logo_key is not null) as has_logo,k.nama_kategori from ormas o join kategori k on k.id=o.kategori_id where o.kode_ormas=? and o.status_publikasi='Publik'`).get(req.params.kode);
  if (!o || S('catalog_public') !== 'true') return res.status(404).json({ error: 'Data ormas tidak ditemukan' });
  o.docs = db.prepare(`select id,jenis_dokumen,nama_file,ukuran_file,uploaded_at from dokumen_ormas where ormas_id=? and klasifikasi_akses='kredensial' and jenis_dokumen is not null and pending=0 order by id`).all(o.id);
  o.company_profile = db.prepare(`select id,nama_file,ukuran_file,uploaded_at from dokumen_ormas where ormas_id=? and jenis_dokumen='company_profile' and pending=0 order by id desc limit 1`).get(o.id) || null;
  res.json(o);
});

// Company Profile ormas: TERBUKA untuk umum (tanpa username/password), hanya untuk ormas yang dipublikasikan
app.get('/api/public/ormas/:kode/company-profile', limiter({ limit: 60 }), (req, res) => {
  const d = db.prepare(`select d.*,o.status_publikasi from dokumen_ormas d join ormas o on o.id=d.ormas_id where o.kode_ormas=? and d.jenis_dokumen='company_profile' and d.pending=0 order by d.id desc limit 1`).get(req.params.kode);
  if (!d || d.status_publikasi !== 'Publik' || S('catalog_public') !== 'true') return res.status(404).json({ error: 'Company profile tidak tersedia' });
  sendPdf(req, res, d, req.query.dl === '1', null);
});

app.get('/api/logo/:kode', async (req, res) => {
  try {
    if (req.query.pending === '1') { // logo kiriman ormas yang belum diverifikasi: hanya admin dan ormas itu sendiri
      if (!getAdmin(req) && getPortal(req)?.ormas.kode_ormas !== req.params.kode) return res.status(404).end();
      const pr = db.prepare('select p.logo_key from perubahan_ormas p join ormas o on o.id=p.ormas_id where o.kode_ormas=?').get(req.params.kode);
      const pf = pr?.logo_key && path.join(PENDING, path.basename(pr.logo_key));
      if (!pf || !fs.existsSync(pf)) return res.status(404).end();
      res.set('Cache-Control', 'no-store');
      return res.type(sniffImg(pf)).sendFile(pf);
    }
    const o = db.prepare('select logo_key,status_publikasi from ormas where kode_ormas=?').get(req.params.kode);
    if (!o?.logo_key || (o.status_publikasi !== 'Publik' && !getAdmin(req) && getPortal(req)?.ormas.kode_ormas !== req.params.kode)) return res.status(404).end();
    res.set('Cache-Control', 'private, max-age=300');
    if (isDrive(o.logo_key)) {
      const id = o.logo_key.slice(3);
      let buf = logoCache.get(id);
      if (!buf) { buf = await retry(() => driveDownload(id), [800, 2000]); logoCache.set(id, buf); if (logoCache.size > 100) logoCache.delete(logoCache.keys().next().value); }
      return res.type(sniffBuf(buf)).send(buf);
    }
    const p = path.join(LOGOS, path.basename(o.logo_key));
    if (!fs.existsSync(p)) return res.status(404).end();
    res.type(sniffImg(p)).sendFile(p);
  } catch (e) {
    console.error('Gagal mengambil logo:', e.message);
    res.status(502).end();
  }
});

app.post('/api/public/ormas/:kode/access', accessLimiter, (req, res) => {
  const o = db.prepare(`select id,kode_ormas,nama_ormas from ormas where kode_ormas=? and status_publikasi='Publik'`).get(req.params.kode);
  const { username, password } = req.body || {};
  let c = null;
  if (o) { ensureOne(o.id); c = db.prepare(`select * from kredensial_harian where ormas_id=? and tanggal_berlaku=? and status='aktif'`).get(o.id, today()); }
  const okPass = bcrypt.compareSync(String(password || '').slice(0, 100), c?.password_hash || DUMMY_HASH);
  const ok = !!(c && okPass && String(username || '') === c.username && new Date(c.tanggal_kedaluwarsa) > new Date());
  if (!ok) { log(req, 'akses_dokumen_publik', o?.id, `Akses ditolak untuk ${req.params.kode}`, 'gagal'); return res.status(401).json({ error: 'INVALID' }); }
  const ttl = Math.max(1, Math.min(30 * 60, Math.floor((new Date(c.tanggal_kedaluwarsa).getTime() - Date.now()) / 1000))); // tidak melewati pergantian hari
  // cid = id kredensial yang dipakai: sesi langsung tidak sah jika admin membuat ulang password harian
  const token = jwt.sign({ k: o.kode_ormas, scope: 'doc', cid: c.id }, SECRET, { expiresIn: ttl });
  const docs = db.prepare(`select id,nama_file,ukuran_file,uploaded_at from dokumen_ormas where ormas_id=? and klasifikasi_akses='kredensial' and pending=0 order by id`).all(o.id);
  log(req, 'akses_dokumen_publik', o.id, `Akses dokumen ${o.kode_ormas} berhasil`);
  res.json({ token, kode: o.kode_ormas, nama: o.nama_ormas, docs, expires_at: new Date(Date.now() + ttl * 1000).toISOString() });
});

app.get('/api/public/files/:id', (req, res) => {
  let p; try { p = jwt.verify(String(req.query.token || ''), SECRET); if (p.scope !== 'doc') throw 0; } catch { return res.status(401).json({ error: 'Akses kedaluwarsa, silakan masuk kembali' }); }
  if (!sessionAktif(p)) return res.status(401).json({ error: 'SESI_HABIS' });
  const d = db.prepare(`select d.*,o.kode_ormas,o.status_publikasi from dokumen_ormas d join ormas o on o.id=d.ormas_id where d.id=?`).get(+req.params.id);
  if (!d || d.kode_ormas !== p.k || d.klasifikasi_akses !== 'kredensial' || d.status_publikasi !== 'Publik' || d.pending) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
  sendPdf(req, res, d, req.query.dl === '1', 'akses_dokumen_publik');
});

function sendPdf(req, res, d, download, jenis) {
  const mime = d.mime_type || 'application/pdf', isPdf = mime === 'application/pdf';
  const drive = isDrive(d.storage_key);
  const p = drive ? null : path.join(d.pending ? PENDING : FILES, path.basename(d.storage_key));
  if (!drive && !fs.existsSync(p)) return res.status(404).json({ error: 'Berkas tidak ditemukan di penyimpanan' });
  if (jenis && (!req.headers.range || req.headers.range.startsWith('bytes=0-'))) log(req, jenis, d.ormas_id, `${download ? 'Unduh' : 'Buka'} dokumen: ${d.nama_file}`);
  res.removeHeader('Content-Security-Policy'); // agar viewer PDF bawaan browser dapat berjalan
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `${download || !isPdf ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(d.nama_file)}` });
  if (drive) {
    retry(() => driveDownload(d.storage_key.slice(3)), [800, 2000])
      .then((buf) => res.type(mime).send(buf))
      .catch((e) => { console.error('Gagal mengambil dari Google Drive:', e.message); res.status(502).json({ error: 'Dokumen tidak dapat diambil dari Google Drive saat ini. Coba lagi sebentar lagi.' }); });
    return;
  }
  res.sendFile(p, { headers: { 'Content-Type': mime } });
}

// ===== Auth admin =====
app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  const a = db.prepare('select a.*,r.nama_role from admin a join roles r on r.id=a.role_id where a.username=?').get(String(username || '').slice(0, 60));
  const pass = bcrypt.compareSync(String(password || '').slice(0, 100), a?.password_hash || DUMMY_HASH);
  if (!a || !pass || a.status_akun !== 'aktif') { log(req, 'login', null, 'Login gagal', 'gagal', { username: String(username || '').slice(0, 40) }); return res.status(401).json({ error: 'Username atau password salah' }); }
  db.prepare('update admin set last_login=? where id=?').run(now(), a.id);
  setAdminCookie(res, a);
  log(req, 'login', null, 'Login berhasil', 'berhasil', a);
  res.json({ ok: true, must_change: !!a.must_change });
});
// Logout mencabut token di server (bukan hanya menghapus cookie), jadi cookie yang sempat tersalin tidak bisa dipakai lagi
app.post('/api/auth/logout', (req, res) => { const a = getAdmin(req); if (a) log(req, 'logout', null, 'Logout', 'berhasil', a); hd.revoke(req.cookies?.sid); res.clearCookie('sid').json({ ok: true }); });

const smtpOn = () => !!process.env.SMTP_HOST;
const appUrl = () => (process.env.APP_URL || (fs.existsSync(path.join(__dirname, '../client/dist')) ? `http://localhost:${PORT}` : 'http://localhost:5173')).replace(/\/$/, '');
const mailFrom = () => process.env.SMTP_FROM || (process.env.SMTP_USER ? `"${S('app_name')}" <${process.env.SMTP_USER}>` : S('recovery_from'));
// Tiap percobaan memakai koneksi SMTP baru (koneksi lama yang sudah diputus Gmail tidak dipakai lagi), dengan batas waktu.
// Email dikirim di latar belakang, jadi percobaan ulang tidak membuat halaman menunggu.
const newMailer = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587, secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000, dnsTimeout: 10000,
});
async function sendMail(to, subject, text) {
  if (!smtpOn()) {
    console.log(`\n[EMAIL TIDAK TERKIRIM: SMTP belum diatur di .env]\nKepada: ${to}\n${subject}\n${text}\n`); // hanya untuk pengembangan lokal
    throw new Error('SMTP belum diatur di file .env');
  }
  await retry(async (i) => {
    const m = newMailer();
    try { await m.sendMail({ from: mailFrom(), to, subject, text }); }
    catch (e) { if (i < 3) console.warn(`Kirim email gagal (percobaan ${i + 1}): ${e.message}`); throw e; }
    finally { m.close(); }
  }, [3000, 8000, 20000]);
}
// Halaman langsung dijawab; email dikirim di latar belakang agar pengguna tidak menunggu koneksi SMTP.
app.post('/api/auth/forgot', forgotLimiter, (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 120);
  const a = db.prepare(`select * from admin where lower(email)=? and status_akun='aktif'`).get(email);
  let job = null;
  if (a) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('insert into reset_tokens(admin_id,token_hash,expires_at) values(?,?,?)').run(a.id, crypto.createHash('sha256').update(token).digest('hex'), new Date(Date.now() + 30 * 60000).toISOString());
    const link = `${appUrl()}/admin/reset?token=${token}`;
    job = async () => {
      try { await sendMail(a.email, `Pemulihan password ${S('app_name')}`, `Klik tautan berikut untuk membuat password baru (berlaku 30 menit, sekali pakai):\n${link}\n\nAbaikan email ini jika Anda tidak memintanya.`); log(null, 'reset_password', null, 'Permintaan reset dikirim', 'berhasil', a); }
      catch (e) { console.error('Gagal kirim email:', e.message); log(null, 'reset_password', null, 'Gagal mengirim email reset', 'gagal', a); }
    };
  }
  res.json({ ok: true, message: 'Jika email terdaftar, tautan pemulihan telah dikirim.' });
  if (job) job();
});
app.post('/api/auth/reset', forgotLimiter, (req, res) => {
  const { token, password } = req.body || {};
  if (!validPassword(password)) return res.status(400).json({ error: PW_MSG });
  const h = crypto.createHash('sha256').update(String(token || '')).digest('hex');
  const t = db.prepare('select * from reset_tokens where token_hash=? and used=0').get(h);
  if (!t || new Date(t.expires_at) < new Date()) return res.status(400).json({ error: 'Tautan tidak valid atau sudah kedaluwarsa' });
  const target = db.prepare('select a.*,r.nama_role from admin a join roles r on r.id=a.role_id where a.id=?').get(t.admin_id);
  if (!validPassword(password, [target?.username, target?.email])) return res.status(400).json({ error: PW_MSG });
  db.transaction(() => {
    db.prepare('update reset_tokens set used=1 where id=?').run(t.id);
    db.prepare('update admin set password_hash=?,must_change=0,updated_at=? where id=?').run(bcrypt.hashSync(password, 10), now(), t.admin_id);
  })();
  log(null, 'ubah_password', null, 'Password diubah melalui pemulihan email', 'berhasil', target);
  res.json({ ok: true });
});

// ===== Portal ormas: akun TETAP milik ormas (terpisah dari kredensial harian PDF) =====
const portalLimiter = limiter();
const PORTAL_FIELDS = ['nama_ketua', 'sekretaris', 'bendahara', 'nomor_whatsapp_ketua', 'email_ormas', 'alamat', 'bentuk', 'bidang_kegiatan', 'kemantren', 'legal_jenis', 'nomor_sk', 'legal_tahun', 'legal_berlaku_sd', 'skto_nomor', 'skto_tahun', 'skto_berlaku_sd', ...INT_FIELDS, 'link_dokumentasi', 'link_instagram', 'link_youtube', 'link_tiktok'];
const portalUser = (kode) => kode.toLowerCase().replace('-', '');
function newPortalAccount(ormasId, kode) {
  const password = rnd(10), username = portalUser(kode);
  db.prepare(`insert into akun_ormas(ormas_id,username,password_hash,must_change,created_at,updated_at) values(?,?,?,1,?,?) on conflict(ormas_id) do update set password_hash=excluded.password_hash,must_change=1,updated_at=excluded.updated_at`)
    .run(ormasId, username, bcrypt.hashSync(password, 10), now(), now());
  return { username, password };
}
function getPortal(req) {
  try {
    const p = jwt.verify(req.cookies?.oid, SECRET); if (p.scope !== 'portal' || hd.isRevoked(p.jti)) return null;
    const akun = db.prepare('select * from akun_ormas where ormas_id=?').get(p.o);
    const ormas = db.prepare('select * from ormas where id=?').get(p.o);
    if (!akun || !ormas || akun.password_hash.slice(-16) !== p.pv) return null; // sesi lama mati jika password berubah
    return { akun, ormas };
  } catch { return null; }
}
const portalAuth = (allowMust = false) => (req, res, next) => {
  const s = getPortal(req);
  if (!s) return res.status(401).json({ error: 'Sesi tidak valid, silakan login kembali' });
  if (s.akun.must_change && !allowMust) return res.status(403).json({ error: 'GANTI_PASSWORD' });
  req.portal = s; next();
};
const portalWho = (s) => ({ username: s.akun.username, nama_role: 'Ormas' });
function setPortalCookie(res, akun) {
  const mins = +S('session_minutes') || 120;
  res.cookie('oid', jwt.sign({ o: akun.ormas_id, scope: 'portal', jti: hd.newJti(), pv: akun.password_hash.slice(-16) }, SECRET, { expiresIn: mins * 60 }), { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', maxAge: mins * 60000 });
}

app.post('/api/portal/login', portalLimiter, (req, res) => {
  const { username, password } = req.body || {};
  const akun = db.prepare('select * from akun_ormas where username=?').get(String(username || '').trim().toLowerCase().slice(0, 40));
  const ok = bcrypt.compareSync(String(password || '').slice(0, 100), akun?.password_hash || DUMMY_HASH);
  if (!akun || !ok) { log(req, 'login_ormas', akun?.ormas_id, 'Login ormas gagal', 'gagal', { username: String(username || '').slice(0, 40), nama_role: 'Ormas' }); return res.status(401).json({ error: 'Username atau password salah' }); }
  db.prepare('update akun_ormas set last_login=? where ormas_id=?').run(now(), akun.ormas_id);
  setPortalCookie(res, akun);
  log(req, 'login_ormas', akun.ormas_id, 'Login ormas berhasil', 'berhasil', { username: akun.username, nama_role: 'Ormas' });
  res.json({ ok: true, must_change: !!akun.must_change });
});
app.post('/api/portal/logout', (req, res) => { hd.revoke(req.cookies?.oid); res.clearCookie('oid').json({ ok: true }); });

const pendingOf = (ormasId) => {
  const r = db.prepare('select * from perubahan_ormas where ormas_id=?').get(ormasId);
  if (!r) return null;
  let data = {}; try { data = JSON.parse(r.data); } catch {}
  return { ...r, data };
};
app.get('/api/portal/me', portalAuth(true), (req, res) => {
  const { akun, ormas: o } = req.portal;
  const pd = pendingOf(o.id);
  const live = db.prepare('select id,jenis_dokumen,nama_file,ukuran_file,uploaded_at,pending from dokumen_ormas where ormas_id=? and pending=0 order by id').all(o.id);
  const pend = db.prepare('select id,jenis_dokumen,nama_file,ukuran_file,uploaded_at,pending from dokumen_ormas where ormas_id=? and pending=1 order by id').all(o.id);
  const docs = [...live.filter((d) => !pend.some((x) => x.jenis_dokumen === d.jenis_dokumen)), ...pend];
  const logoBaru = !!pd?.logo_key, logoHapus = !!pd?.remove_logo && !pd?.logo_key;
  res.json({
    kode_ormas: o.kode_ormas, username: akun.username, must_change: !!akun.must_change, nama_ormas: o.nama_ormas,
    nama_kategori: db.prepare('select nama_kategori from kategori where id=?').get(o.kategori_id)?.nama_kategori,
    status_dokumen: o.status_dokumen, status_operasional: o.status_operasional, status_publikasi: o.status_publikasi,
    has_logo: logoBaru || (!!o.logo_key && !logoHapus), logo_pending: logoBaru, updated_at: pd?.updated_at || o.updated_at,
    pending: !!pd, catatan_penolakan: pd ? '' : o.catatan_penolakan || '',
    ...Object.fromEntries(PORTAL_FIELDS.map((f) => [f, (pd ? pd.data[f] : o[f]) ?? ''])),
    docs: docs.map((d) => ({ ...d, pending: !!d.pending })),
  });
});

app.post('/api/portal/change-password', portalAuth(true), (req, res) => {
  const { old_password, new_password } = req.body || {};
  const { akun } = req.portal;
  if (!bcrypt.compareSync(String(old_password || ''), akun.password_hash)) return res.status(400).json({ error: 'Password lama salah' });
  if (new_password === old_password) return res.status(400).json({ error: 'Password baru harus berbeda dari password lama' });
  if (!validPassword(new_password, [akun.username])) return res.status(400).json({ error: PW_MSG });
  db.prepare('update akun_ormas set password_hash=?,must_change=0,updated_at=? where ormas_id=?').run(bcrypt.hashSync(new_password, 10), now(), akun.ormas_id);
  setPortalCookie(res, db.prepare('select * from akun_ormas where ormas_id=?').get(akun.ormas_id));
  log(req, 'ubah_password_ormas', akun.ormas_id, 'Ormas mengubah password portal', 'berhasil', portalWho(req.portal));
  res.json({ ok: true });
});

// Ormas hanya bisa mengubah ormasnya sendiri: id diambil dari sesi, bukan dari permintaan.
// Perubahan TIDAK langsung dipakai katalog dan Google Drive: disimpan sebagai usulan (tabel perubahan_ormas + berkas di data/pending)
// sampai admin memverifikasinya.
app.put('/api/portal/profile', portalAuth(), uploadPending, (req, res) => {
  const o = req.portal.ormas, b = { ...req.body, nama_ormas: o.nama_ormas, kategori_id: o.kategori_id };
  const logo = req.files?.logo?.[0], docs = uploadedDocs(req);
  const err = validateOrmas(b); if (err) return fail(req, res, err);
  const vals = Object.fromEntries(PORTAL_FIELDS.map((k) => [k, k === 'email_ormas' ? String(b[k] ?? '').trim().toLowerCase() : String(b[k] ?? '').trim()]));
  vals.link_instagram = igUrl(vals.link_instagram);
  const ex = pendingOf(o.id);
  const exDocs = db.prepare('select * from dokumen_ormas where ormas_id=? and pending=1').all(o.id);
  const wantRemove = b.remove_logo === '1' && !logo && !!o.logo_key;
  const fieldsChanged = PORTAL_FIELDS.some((k) => vals[k] !== String(o[k] ?? ''));
  if (!ex && !fieldsChanged && !docs.length && !logo && !wantRemove) return res.json({ ok: true, changed: false });

  // Logo usulan: unggahan baru menggantikan yang lama, "hapus" membatalkan unggahan, selain itu usulan lama dipertahankan
  let logoKey = ex?.logo_key || null, logoNama = ex?.logo_nama || null, removeLogo = ex?.remove_logo ? 1 : 0, oldLogoFile = null;
  if (logo) { oldLogoFile = logoKey; logoKey = logo.filename; logoNama = cleanName(logo.originalname); removeLogo = 0; }
  else if (wantRemove) { oldLogoFile = logoKey; logoKey = null; logoNama = null; removeLogo = 1; }
  const replacedPending = exDocs.filter((d) => docs.some(([j]) => j === d.jenis_dokumen));
  const noLogoChange = !logoKey && !removeLogo;
  const keepDocs = exDocs.length - replacedPending.length + docs.length;
  const cancel = !fieldsChanged && keepDocs === 0 && noLogoChange; // semuanya kembali sama dengan data resmi: usulan dibatalkan
  const t0 = now();
  db.transaction(() => {
    replacedPending.forEach((d) => db.prepare('delete from dokumen_ormas where id=?').run(d.id));
    docs.forEach(([j, f]) => addDoc(o.id, j, f, null, 1));
    if (cancel) {
      db.prepare('delete from perubahan_ormas where ormas_id=?').run(o.id);
      if (ex) db.prepare('update ormas set status_dokumen=? where id=?').run(ex.status_sebelumnya || 'Belum Lengkap', o.id);
    } else {
      db.prepare(`insert into perubahan_ormas(ormas_id,data,logo_key,logo_nama,remove_logo,status_sebelumnya,created_at,updated_at) values(?,?,?,?,?,?,?,?)
        on conflict(ormas_id) do update set data=excluded.data,logo_key=excluded.logo_key,logo_nama=excluded.logo_nama,remove_logo=excluded.remove_logo,updated_at=excluded.updated_at`)
        .run(o.id, JSON.stringify(vals), logoKey, logoNama, removeLogo, ex ? ex.status_sebelumnya : o.status_dokumen, ex ? ex.created_at : t0, t0);
      // Hanya penanda status. Data katalog (nama, pengurus, kontak, logo, PDF) tetap yang lama sampai diverifikasi.
      db.prepare(`update ormas set status_dokumen='Perlu Diverifikasi',updated_at=? where id=?`).run(t0, o.id);
    }
  })();
  replacedPending.forEach((d) => removeStored(d.storage_key, true));
  if (oldLogoFile) unlink(PENDING, oldLogoFile);
  log(req, 'ubah_ormas_mandiri', o.id, cancel ? 'Ormas membatalkan usulan perubahan' : `Ormas mengajukan perubahan${docs.length ? ': ' + docs.map(([j]) => DOC_TYPES[j]).join(', ') : ''}`, 'berhasil', portalWho(req.portal));
  if (!cancel) notify({ jenis: 'ormas', judul: `${o.kode_ormas} mengajukan perubahan`, pesan: `Ormas (${o.nama_ormas}) Telah Melakukan Perubahan, CEK SELENGKAPNYA DAN KONFIRMASI PERUBAHAN`, ormasId: o.id });
  res.json({ ok: true, changed: !cancel });
});

app.get('/api/portal/files/:id', portalAuth(), (req, res) => {
  const d = db.prepare('select * from dokumen_ormas where id=? and ormas_id=?').get(+req.params.id, req.portal.ormas.id);
  if (!d) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
  req.admin = portalWho(req.portal);
  sendPdf(req, res, d, req.query.dl === '1', 'akses_dokumen_ormas');
});

app.post('/api/portal/forgot', forgotLimiter, (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 120);
  const rows = email ? db.prepare('select o.id,o.kode_ormas,o.nama_ormas,a.username from ormas o join akun_ormas a on a.ormas_id=o.id where lower(o.email_ormas)=?').all(email) : [];
  const jobs = rows.map((r) => {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('insert into reset_tokens_ormas(ormas_id,token_hash,expires_at) values(?,?,?)').run(r.id, crypto.createHash('sha256').update(token).digest('hex'), new Date(Date.now() + 30 * 60000).toISOString());
    const link = `${appUrl()}/ormas-login/reset?token=${token}`;
    return async () => {
      try { await sendMail(email, `Pemulihan password ${r.nama_ormas}`, `Username portal ormas Anda: ${r.username}\n\nKlik tautan berikut untuk membuat password baru (berlaku 30 menit, sekali pakai):\n${link}\n\nAbaikan email ini jika Anda tidak memintanya.`); log(null, 'reset_password_ormas', r.id, 'Tautan reset dikirim', 'berhasil', { username: r.username, nama_role: 'Ormas' }); }
      catch (e) { console.error('Gagal kirim email:', e.message); log(null, 'reset_password_ormas', r.id, 'Gagal mengirim email reset', 'gagal', { username: r.username, nama_role: 'Ormas' }); }
    };
  });
  res.json({ ok: true, message: 'Jika email terdaftar, tautan pemulihan telah dikirim.' });
  jobs.forEach((j) => j());
});
app.post('/api/portal/reset', forgotLimiter, (req, res) => {
  const { token, password } = req.body || {};
  if (!validPassword(password)) return res.status(400).json({ error: PW_MSG });
  const t = db.prepare('select * from reset_tokens_ormas where token_hash=? and used=0').get(crypto.createHash('sha256').update(String(token || '')).digest('hex'));
  if (!t || new Date(t.expires_at) < new Date()) return res.status(400).json({ error: 'Tautan tidak valid atau sudah kedaluwarsa' });
  const uname = db.prepare('select username from akun_ormas where ormas_id=?').get(t.ormas_id)?.username;
  if (!validPassword(password, [uname])) return res.status(400).json({ error: PW_MSG });
  db.transaction(() => {
    db.prepare('update reset_tokens_ormas set used=1 where id=?').run(t.id);
    db.prepare('update akun_ormas set password_hash=?,must_change=0,updated_at=? where ormas_id=?').run(bcrypt.hashSync(password, 10), now(), t.ormas_id);
  })();
  log(null, 'ubah_password_ormas', t.ormas_id, 'Password portal diubah lewat pemulihan email', 'berhasil', { username: uname, nama_role: 'Ormas' });
  res.json({ ok: true });
});

// ===== Admin =====
const meOut = (a) => ({ id: a.id, nama: a.nama, username: a.username, email: a.email, role: a.nama_role, perms: a.perms, must_change: !!a.must_change, last_login: a.last_login });
app.get('/api/admin/me', auth(null, true), (req, res) => res.json(meOut(req.admin)));
app.post('/api/admin/change-password', auth(null, true), (req, res) => {
  const { old_password, new_password } = req.body || {};
  const em = String(req.body?.email || '').trim().toLowerCase();
  if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return res.status(400).json({ error: 'Email tidak valid' });
  if (req.admin.email.endsWith('@sidomas.local') && !em) return res.status(400).json({ error: 'Isi email aktif Anda agar fitur lupa password bisa mengirim tautan' });
  if (!bcrypt.compareSync(String(old_password || ''), req.admin.password_hash)) return res.status(400).json({ error: 'Password lama salah' });
  if (new_password === old_password) return res.status(400).json({ error: 'Password baru harus berbeda dari password lama' });
  if (!validPassword(new_password, [req.admin.username, em || req.admin.email])) return res.status(400).json({ error: PW_MSG });
  if (em) { try { db.prepare('update admin set email=? where id=?').run(em, req.admin.id); } catch { return res.status(400).json({ error: 'Email sudah dipakai akun lain' }); } }
  db.prepare('update admin set password_hash=?,must_change=0,updated_at=? where id=?').run(bcrypt.hashSync(new_password, 10), now(), req.admin.id);
  setAdminCookie(res, db.prepare('select * from admin where id=?').get(req.admin.id)); // sesi lama mati karena password berubah; sesi ini diperbarui
  log(req, 'ubah_password', null, 'Mengubah password sendiri');
  res.json({ ok: true });
});

app.get('/api/admin/dashboard', auth('view_ormas'), (req, res) => {
  const c = (w = '1=1') => db.prepare(`select count(*) c from ormas where ${w}`).get().c;
  const base = `from ormas o join kategori k on k.id=o.kategori_id`;
  const dk = dokKedaluwarsa();
  res.json({
    stats: { pendaftaran_baru: pendCount(), terdaftar: c(), aktif: c(`status_operasional='Aktif'`), belum_lengkap: c(`status_dokumen='Belum Lengkap'`), perlu_verifikasi: c(`status_dokumen='Perlu Diverifikasi'`), kedaluwarsa: c(`status_dokumen='Kedaluwarsa'`) },
    by_kategori: db.prepare(`select k.nama_kategori name, count(o.id) value from kategori k left join ormas o on o.kategori_id=k.id group by k.id having count(o.id)>0 order by value desc`).all(),
    by_status: DOC_ST.map((s) => ({ name: s, value: c(`status_dokumen='${s}'`) })),
    terbaru: db.prepare(`select o.id,o.kode_ormas,o.nama_ormas,o.status_dokumen,o.created_at,k.nama_kategori ${base} order by o.id desc limit 5`).all(),
    perlu_verifikasi: db.prepare(`select o.id,o.kode_ormas,o.nama_ormas,o.updated_at,k.nama_kategori ${base} where o.status_dokumen='Perlu Diverifikasi' order by o.updated_at desc limit 5`).all(),
    // Dokumen kedaluwarsa dihitung dari tanggal "Berlaku s/d" SKTO dan legal standing (bukan dari status manual)
    dok_kedaluwarsa: { sudah: dk.sudah, segera: dk.segera, tidak_terbaca: dk.tidak_terbaca.length, items: dk.items.slice(0, 6) },
    last_update: db.prepare('select max(updated_at) m from ormas').get().m,
  });
});

// --- Data ormas ---
const TEXT_FIELDS = { nama_ketua: 150, sekretaris: 150, bendahara: 150, nomor_whatsapp_ketua: 25, email_ormas: 120, alamat: 500, bentuk: 100, bidang_kegiatan: 300, legal_jenis: 100, nomor_sk: 100, legal_tahun: 4, legal_berlaku_sd: 50, skto_nomor: 100, skto_tahun: 4, skto_berlaku_sd: 50, validasi: 100, catatan_verifikasi: 1000, link_dokumentasi: 500, link_instagram: 200, link_youtube: 200, link_tiktok: 200 };
function validateOrmas(b) {
  const nama = String(b.nama_ormas || '').trim();
  if (!nama) return 'Nama ormas wajib diisi';
  if (nama.length > 200) return 'Nama ormas terlalu panjang';
  if (!b.kategori_id || !db.prepare('select 1 from kategori where id=?').get(+b.kategori_id)) return 'Kategori wajib dipilih';
  for (const [k, max] of Object.entries(TEXT_FIELDS)) if (String(b[k] || '').trim().length > max) return `Isian "${k.replace(/_/g, ' ')}" terlalu panjang`;
  const wa = String(b.nomor_whatsapp_ketua || '').trim(), em = String(b.email_ormas || '').trim();
  if (wa && !/^\+?[0-9][0-9\s-]{7,19}$/.test(wa)) return 'Nomor telepon tidak valid (contoh: 081234567890 atau +6281234567890)';
  if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return 'Email ormas tidak valid';
  for (const k of ['legal_tahun', 'skto_tahun']) if (b[k] && !/^(19|20)\d{2}$/.test(String(b[k]).trim())) return 'Tahun harus 4 digit (contoh: 2021)';
  if (b.kemantren && !KEMANTREN.includes(b.kemantren)) return 'Kemantren tidak valid';
  if (b.validasi && !VALIDASI.includes(b.validasi)) return 'Status validasi harus Terdata, Terdaftar, atau Teregister';
  if (b.status_dokumen && !DOC_ST.includes(b.status_dokumen)) return 'Status dokumen tidak valid';
  if (b.status_operasional && !OPS_ST.includes(b.status_operasional)) return 'Status operasional tidak valid';
  if (b.status_publikasi && !PUB_ST.includes(b.status_publikasi)) return 'Status publikasi tidak valid';
  // Jumlah anggota (angka saja)
  const nums = INT_FIELDS.map((k) => String(b[k] ?? '').trim());
  if (nums.some((v) => v !== '' && !/^\d{1,7}$/.test(v))) return 'Jumlah anggota harus berupa angka bulat (0 atau lebih)';
  const [pr, ln, dis, tot] = nums.map((v) => (v === '' ? null : +v));
  if ((pr ?? ln ?? dis) != null && tot == null) return 'Isi juga jumlah total anggota';
  if (tot != null && [pr, ln, dis].some((n) => n != null && n > tot)) return 'Rincian anggota (perempuan, lansia, disabilitas) tidak boleh lebih besar dari jumlah total';
  // Tautan dokumentasi dan Instagram
  const ld = String(b.link_dokumentasi || '').trim();
  if (ld && !urlOk(ld)) return 'Link dokumentasi harus berupa tautan yang diawali http:// atau https://';
  const ig = igUrl(b.link_instagram);
  if (ig && !(urlOk(ig) && /(^|\.)instagram\.com$/i.test(new URL(ig).hostname))) return 'Link Instagram tidak valid (contoh: https://instagram.com/namaormas atau @namaormas)';
  for (const [k, re, nm] of [['link_youtube', /(^|\.)(youtube\.com|youtu\.be)$/i, 'YouTube'], ['link_tiktok', /(^|\.)tiktok\.com$/i, 'TikTok']]) {
    const v = String(b[k] || '').trim();
    if (v && !(urlOk(v) && re.test(new URL(v).hostname))) return `Link ${nm} tidak valid (contoh: https://${nm === 'YouTube' ? 'youtube.com/@namaormas' : 'tiktok.com/@namaormas'})`;
  }
  return null;
}
const rowOf = (b, d = {}) => {
  const r = { nama_ormas: String(b.nama_ormas).trim(), kategori_id: +b.kategori_id, kemantren: String(b.kemantren || '').trim() };
  for (const k of Object.keys(TEXT_FIELDS)) r[k] = String(b[k] ?? '').trim();
  r.email_ormas = r.email_ormas.toLowerCase();
  r.link_instagram = igUrl(r.link_instagram);
  for (const k of INT_FIELDS) { const v = String(b[k] ?? '').trim(); r[k] = v === '' ? null : +v; }
  r.status_dokumen = b.status_dokumen || d.status_dokumen || 'Belum Lengkap';
  r.status_operasional = b.status_operasional || d.status_operasional || 'Aktif';
  r.status_publikasi = b.status_publikasi || d.status_publikasi || 'Disembunyikan';
  return r;
};
const uploadedDocs = (req) => Object.keys(DOC_TYPES).filter((k) => req.files?.[k]?.[0]).map((k) => [k, req.files[k][0]]);
const addDoc = (ormasId, jenis, f, adminId, pending = 0) =>
  db.prepare('insert into dokumen_ormas(ormas_id,jenis_dokumen,nama_file,storage_key,mime_type,ukuran_file,uploaded_at,uploaded_by,klasifikasi_akses,pending) values(?,?,?,?,?,?,?,?,?,?)')
    .run(ormasId, jenis, cleanName(f.originalname), f.filename, docMime(jenis, f.originalname), f.size, now(), adminId, klas(jenis), pending);

app.get('/api/admin/ormas', auth('view_ormas'), (req, res) => res.json(withExpiry(listOrmas(req.query))));
app.get('/api/admin/ormas/:id', auth('view_ormas'), (req, res) => {
  const o = db.prepare('select o.*,k.nama_kategori,(o.logo_key is not null) as has_logo from ormas o join kategori k on k.id=o.kategori_id where o.id=?').get(+req.params.id);
  if (!o) return res.status(404).json({ error: 'Data tidak ditemukan' });
  o.exp = expiryInfo(o);
  o.docs = db.prepare('select id,jenis_dokumen,nama_file,ukuran_file,uploaded_at from dokumen_ormas where ormas_id=? and pending=0 order by id').all(o.id);
  const pd = pendingOf(o.id);
  o.pending = pd ? {
    data: pd.data, updated_at: pd.updated_at, logo: pd.logo_key ? 'baru' : pd.remove_logo ? 'hapus' : null,
    docs: db.prepare('select id,jenis_dokumen,nama_file,ukuran_file,uploaded_at from dokumen_ormas where ormas_id=? and pending=1 order by id').all(o.id),
  } : null;
  o.portal = db.prepare('select username,last_login,must_change,updated_at from akun_ormas where ormas_id=?').get(o.id) || null;
  res.json(o);
});

app.post('/api/admin/ormas', auth('manage_ormas'), upload, toDrive, (req, res) => {
  const b = req.body, logo = req.files?.logo?.[0], docs = uploadedDocs(req);
  const err = validateOrmas(b); if (err) return fail(req, res, err);
  const missing = REQ_DOCS.filter((k) => !docs.some(([j]) => j === k)).map((k) => DOC_TYPES[k]);
  if (missing.length) return fail(req, res, `Dokumen wajib belum diunggah: ${missing.join(', ')}`);
  const row = rowOf(b), cols = Object.keys(row);
  const r = db.transaction(() => {
    const seq = +S('ormas_seq') + 1; setSetting('ormas_seq', seq); // atomik: tidak ada ID ganda
    const kode = 'Ormas-' + String(seq).padStart(3, '0');
    const id = db.prepare(`insert into ormas(kode_ormas,logo_key,${cols.join(',')},created_at,updated_at,created_by,updated_by) values(?,?,${cols.map(() => '?').join(',')},?,?,?,?)`)
      .run(kode, logo?.filename || null, ...cols.map((c) => row[c]), now(), now(), req.admin.id, req.admin.id).lastInsertRowid;
    docs.forEach(([j, f]) => addDoc(id, j, f, req.admin.id));
    return { id, kode };
  }).immediate();
  makeCred(r.id);
  organizeOrmas(r.id);
  log(req, 'tambah_ormas', r.id, `Menambah ${r.kode}: ${row.nama_ormas}`);
  notifAdmin(req, `Menambah ${r.kode}: ${row.nama_ormas}`, r.id);
  const portal = newPortalAccount(r.id, r.kode); // ditampilkan sekali kepada admin
  res.json({ ...r, portal });
});

app.put('/api/admin/ormas/:id', auth('manage_ormas'), upload, toDrive, (req, res) => {
  const id = +req.params.id, b = req.body, logo = req.files?.logo?.[0], docs = uploadedDocs(req);
  const o = db.prepare('select * from ormas where id=?').get(id);
  if (!o) return fail(req, res, 'Data tidak ditemukan', 404);
  if (db.prepare('select 1 from perubahan_ormas where ormas_id=?').get(id)) return fail(req, res, 'Ormas ini punya perubahan yang menunggu verifikasi. Verifikasi atau tolak dulu sebelum mengedit.', 409);
  const err = validateOrmas(b); if (err) return fail(req, res, err);
  const replaced = db.prepare('select * from dokumen_ormas where ormas_id=? and pending=0').all(id).filter((d) => docs.some(([j]) => j === d.jenis_dokumen));
  const removeLogo = b.remove_logo === '1' || !!logo;
  const row = rowOf(b, o), cols = Object.keys(row);
  db.transaction(() => {
    db.prepare(`update ormas set ${cols.map((c) => c + '=?').join(',')},logo_key=?,updated_at=?,updated_by=? where id=?`)
      .run(...cols.map((c) => row[c]), removeLogo ? logo?.filename || null : o.logo_key, now(), req.admin.id, id);
    replaced.forEach((d) => db.prepare('delete from dokumen_ormas where id=?').run(d.id));
    docs.forEach(([j, f]) => addDoc(id, j, f, req.admin.id));
  })();
  replaced.forEach((d) => removeStored(d.storage_key)); // file lama dihapus setelah DB berhasil
  if (removeLogo) removeLogoFile(o.logo_key);
  const ch = []; if (row.status_dokumen !== o.status_dokumen) ch.push(`status dokumen ${o.status_dokumen} → ${row.status_dokumen}`);
  if (docs.length) ch.push(`unggah/ganti: ${docs.map(([j]) => DOC_TYPES[j]).join(', ')}`);
  organizeOrmas(id);
  log(req, 'ubah_ormas', id, `Mengubah ${o.kode_ormas}${ch.length ? ': ' + ch.join('; ') : ''}`);
  notifAdmin(req, `Mengubah ${o.kode_ormas} (${row.nama_ormas})${ch.length ? ': ' + ch.join('; ') : ''}`, id);
  res.json({ ok: true });
});

app.post('/api/admin/ormas/:id/portal-reset', auth('manage_ormas'), (req, res) => {
  const o = db.prepare('select id,kode_ormas from ormas where id=?').get(+req.params.id);
  if (!o) return res.status(404).json({ error: 'Data tidak ditemukan' });
  const portal = newPortalAccount(o.id, o.kode_ormas);
  log(req, 'reset_akun_ormas', o.id, `Admin membuat/mengatur ulang password portal ${o.kode_ormas}`);
  notifAdmin(req, `Mengatur ulang password portal ${o.kode_ormas}`, o.id);
  res.json(portal);
});

// ---------- Pendaftaran ormas baru (halaman publik -> tindak lanjut admin) ----------
// Berkas dan data disimpan sementara (data/pending + tabel pendaftaran_ormas). Baru setelah admin MENYETUJUI:
// ormas dibuat, PDF + logo masuk Google Drive ke folder "Ormas-XXX - Nama Ormas", dan data tampil di katalog.
const daftarLimiter = limiter({ limit: 5 });
// Normalisasi nomor WhatsApp Indonesia: 0812.. / +62812.. / 812.. -> 62812..  (null bila tidak valid)
const waNumber = (raw) => {
  let n = String(raw || '').replace(/[^\d]/g, '');
  if (n.startsWith('0')) n = '62' + n.slice(1); else if (n.startsWith('8')) n = '62' + n;
  return /^62\d{8,13}$/.test(n) ? n : null;
};
// Kirim WhatsApp lewat gateway (bawaan: Fonnte). Diatur di .env: WA_TOKEN (+ opsional WA_API_URL). Tanpa WA_TOKEN fitur ini nonaktif.
// Dijalankan di latar belakang: kegagalan hanya dicatat di terminal dan TIDAK membatalkan pendaftaran.
// Dibatasi (hardening.js): satu nomor hanya menerima satu pesan per 24 jam dan total per hari dibatasi (WA_DAILY_MAX, bawaan 100).
const sendWA = async (to, message) => {
  const token = process.env.WA_TOKEN, target = waNumber(to);
  if (!token) return console.log('[WA] WA_TOKEN belum diisi, pesan WhatsApp tidak dikirim.');
  if (!target) return console.log('[WA] Nomor tujuan tidak valid, pesan tidak dikirim.');
  if (!hd.waAllow(target)) return console.log('[WA] Dilewati: nomor ini sudah menerima pesan dalam 24 jam terakhir atau batas harian tercapai.');
  try {
    const r = await fetch(process.env.WA_API_URL || 'https://api.fonnte.com/send', { method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' }, body: JSON.stringify({ target, message }), signal: AbortSignal.timeout(10000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.status === false) console.error('[WA] Gagal kirim:', r.status, j.reason || j.message || '');
    else console.log('[WA] Terkirim ke', target.slice(0, 5) + '*****' + target.slice(-3));
  } catch (e) { console.error('[WA] Gagal kirim:', e.message); }
};
app.post('/api/public/daftar', daftarLimiter, uploadPending, (req, res) => {
  const kid = db.prepare('select id from kategori order by urutan,id').get()?.id;
  const b = { ...req.body, kategori_id: kid };
  const logo = req.files?.logo?.[0], docs = uploadedDocs(req).filter(([j]) => j !== 'skto'); // pendaftar tidak mengunggah SKTO
  const kat = String(b.kategori_nama || '').trim().replace(/\s+/g, ' ');
  const err = !kid ? 'Sistem belum siap menerima pendaftaran' : !kat || kat.length > 100 ? 'Kategori wajib diisi (maks. 100 karakter)'
    : validateOrmas(b) || (!waNumber(b.nomor_whatsapp_ketua) ? 'Nomor WhatsApp ketua wajib diisi dengan benar (contoh: 081234567890)' : !String(b.nama_ketua || '').trim() ? 'Nama ketua wajib diisi' : !String(b.alamat || '').trim() ? 'Alamat wajib diisi' : null);
  if (err) return fail(req, res, err);
  const nama = String(b.nama_ormas).trim();
  if (db.prepare(`select 1 from ormas where lower(nama_ormas)=lower(?) union select 1 from pendaftaran_ormas where lower(nama_ormas)=lower(?) and status='tindaklanjut'`).get(nama, nama))
    return fail(req, res, 'Ormas dengan nama ini sudah terdaftar atau sedang diproses', 409);
  const { kategori_id, status_dokumen, status_operasional, status_publikasi, ...data } = rowOf(b, {});
  const t = now();
  db.transaction(() => {
    const pid = db.prepare('insert into pendaftaran_ormas(nama_ormas,kategori_nama,data,logo_key,logo_nama,created_at,updated_at) values(?,?,?,?,?,?,?)')
      .run(nama, kat, JSON.stringify(data), logo?.filename || null, logo ? cleanName(logo.originalname) : null, t, t).lastInsertRowid;
    docs.forEach(([j, f]) => db.prepare('insert into pendaftaran_dokumen(pendaftaran_id,jenis,nama_file,storage_key,ukuran) values(?,?,?,?,?)').run(pid, j, cleanName(f.originalname), f.filename, f.size));
  })();
  (req.files?.skto || []).forEach((f) => fs.rm(f.path, { force: true }, () => {}));
  notify({ jenis: 'admin', judul: `Pendaftaran ormas baru: ${nama}`, pesan: 'Ada ormas baru yang mendaftar. TINDAK LANJUTI!' });
  liveBroadcast(); // rute /public tidak memicu sinyal otomatis
  res.json({ ok: true });
  sendWA(b.nomor_whatsapp_ketua, `Halo, ${nama}. Berkas Anda sudah kami terima. Selanjutnya akan kami tindak lanjuti. Mohon menunggu sampai konfirmasi dari kami. Terima kasih.`);
});

const pendCount = () => db.prepare(`select count(*) c from pendaftaran_ormas where status='tindaklanjuti'`).get().c;
app.get('/api/admin/pendaftaran/count', auth('view_ormas'), (req, res) => res.json({ count: pendCount() }));
app.get('/api/admin/pendaftaran', auth('view_ormas'), (req, res) => {
  const rows = db.prepare(`select * from pendaftaran_ormas where status in ('tindaklanjuti','ditolak') order by (status='tindaklanjuti') desc, id desc limit 100`).all();
  res.json(rows.map((p) => ({ ...p, data: JSON.parse(p.data), has_logo: !!p.logo_key, docs: db.prepare('select id,jenis,nama_file,ukuran from pendaftaran_dokumen where pendaftaran_id=?').all(p.id) })));
});
const sendPend = (res, file, mime) => {
  if (!file || !fs.existsSync(file)) return res.status(404).json({ error: 'Berkas tidak ditemukan' });
  res.set({ 'Content-Type': mime, 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }); res.sendFile(file);
};
app.get('/api/admin/pendaftaran/:id/dok/:did', auth('view_docs'), (req, res) => {
  const d = db.prepare('select * from pendaftaran_dokumen where id=? and pendaftaran_id=?').get(+req.params.did, +req.params.id);
  sendPend(res, d && path.join(PENDING, path.basename(d.storage_key)), 'application/pdf');
});
app.get('/api/admin/pendaftaran/:id/logo', auth('view_ormas'), (req, res) => {
  const p = db.prepare('select logo_key from pendaftaran_ormas where id=?').get(+req.params.id);
  const f = p?.logo_key && path.join(PENDING, path.basename(p.logo_key));
  sendPend(res, f, f && fs.existsSync(f) ? sniffImg(f) : 'image/png');
});

app.post('/api/admin/pendaftaran/:id/approve', auth('manage_ormas'), async (req, res) => {
  const p = db.prepare(`select * from pendaftaran_ormas where id=? and status='tindaklanjuti'`).get(+req.params.id);
  if (!p) return res.status(404).json({ error: 'Pendaftaran tidak ditemukan atau sudah diproses' });
  const kn = String(req.body?.kategori_nama || p.kategori_nama).trim().replace(/\s+/g, ' ').slice(0, 100);
  if (!kn) return res.status(400).json({ error: 'Kategori wajib diisi' });
  const pdocs = db.prepare('select * from pendaftaran_dokumen where pendaftaran_id=?').all(p.id);
  const uploaded = [], moved = [], keys = new Map(); let logoKey = null;
  const undo = () => { uploaded.forEach((g) => driveDelete(g)); moved.forEach(([dst, src]) => { try { fs.renameSync(dst, src); } catch {} }); };
  try {
    for (const d of pdocs) {
      const src = path.join(PENDING, path.basename(d.storage_key));
      if (!fs.existsSync(src)) throw new Error(`Berkas "${d.nama_file}" tidak ditemukan di penyimpanan sementara`);
      if (driveOn()) { const g = await driveUpload(src, `${DOC_TYPES[d.jenis] || 'Dokumen'} - ${d.nama_file}`, { kind: 'pdf', mime: docMime(d.jenis, d.nama_file) }); uploaded.push(g); keys.set(d.id, 'gd:' + g); }
      else { const dst = path.join(FILES, path.basename(d.storage_key)); fs.renameSync(src, dst); moved.push([dst, src]); keys.set(d.id, d.storage_key); }
    }
    if (p.logo_key) {
      const src = path.join(PENDING, path.basename(p.logo_key));
      if (!fs.existsSync(src)) throw new Error('Logo tidak ditemukan di penyimpanan sementara');
      if (driveOn()) { const g = await driveUpload(src, `Logo - ${p.logo_nama || 'logo'}`, { kind: 'logo', mime: sniffImg(src) }); uploaded.push(g); logoKey = 'gd:' + g; }
      else { const dst = path.join(LOGOS, path.basename(p.logo_key)); fs.renameSync(src, dst); moved.push([dst, src]); logoKey = p.logo_key; }
    }
  } catch (e) { undo(); console.error('Gagal memproses berkas pendaftaran:', e.message); return res.status(502).json({ error: `Berkas gagal dipindahkan: ${e.message}` }); }
  let r;
  try {
    r = db.transaction(() => {
      let kat = db.prepare('select id from kategori where lower(nama_kategori)=lower(?)').get(kn);
      if (!kat) kat = { id: db.prepare('insert into kategori(nama_kategori,status_aktif,urutan) values(?,1,?)').run(kn, db.prepare('select coalesce(max(urutan),0)+1 n from kategori').get().n).lastInsertRowid };
      const row = rowOf({ ...JSON.parse(p.data), nama_ormas: p.nama_ormas, kategori_id: kat.id }, {});
      row.status_publikasi = 'Publik'; // tampil di katalog setelah disetujui
      row.status_dokumen = pdocs.filter((d) => REQ_DOCS.includes(d.jenis)).length >= REQ_DOCS.length ? 'Lengkap' : 'Belum Lengkap';
      const cols = Object.keys(row);
      const seq = +S('ormas_seq') + 1; setSetting('ormas_seq', seq);
      const kode = 'Ormas-' + String(seq).padStart(3, '0');
      const id = db.prepare(`insert into ormas(kode_ormas,logo_key,${cols.join(',')},created_at,updated_at,created_by,updated_by) values(?,?,${cols.map(() => '?').join(',')},?,?,?,?)`)
        .run(kode, logoKey, ...cols.map((c) => row[c]), now(), now(), req.admin.id, req.admin.id).lastInsertRowid;
      pdocs.forEach((d) => db.prepare('insert into dokumen_ormas(ormas_id,jenis_dokumen,nama_file,storage_key,mime_type,ukuran_file,uploaded_at,uploaded_by,klasifikasi_akses,pending) values(?,?,?,?,?,?,?,?,?,0)')
        .run(id, d.jenis, d.nama_file, keys.get(d.id), docMime(d.jenis, d.nama_file), d.ukuran, now(), req.admin.id, klas(d.jenis)));
      db.prepare(`update pendaftaran_ormas set status='disetujui',ormas_id=?,kategori_nama=?,updated_at=? where id=?`).run(id, kn, now(), p.id);
      return { id, kode };
    }).immediate();
  } catch (e) { undo(); console.error('Gagal menyetujui pendaftaran:', e.message); return res.status(500).json({ error: 'Pendaftaran gagal disetujui. Tidak ada data yang berubah.' }); }
  if (driveOn()) { pdocs.forEach((d) => unlink(PENDING, d.storage_key)); unlink(PENDING, p.logo_key); }
  makeCred(r.id);
  organizeOrmas(r.id); // membuat folder "Ormas-XXX - Nama" di Drive dan memindahkan PDF + logo ke dalamnya
  const portal = newPortalAccount(r.id, r.kode); // ditampilkan sekali kepada admin untuk diberikan ke ormas
  log(req, 'setujui_pendaftaran', r.id, `Menyetujui pendaftaran ${r.kode}: ${p.nama_ormas}`);
  notifAdmin(req, `Menyetujui pendaftaran ormas baru ${r.kode} (${p.nama_ormas})`, r.id);
  res.json({ ...r, portal });
});

app.post('/api/admin/pendaftaran/:id/reject', auth('manage_ormas'), (req, res) => {
  const p = db.prepare(`select * from pendaftaran_ormas where id=? and status='tindaklanjuti'`).get(+req.params.id);
  if (!p) return res.status(404).json({ error: 'Pendaftaran tidak ditemukan atau sudah diproses' });
  db.prepare('select storage_key from pendaftaran_dokumen where pendaftaran_id=?').all(p.id).forEach((d) => unlink(PENDING, d.storage_key));
  unlink(PENDING, p.logo_key);
  db.transaction(() => {
    db.prepare('delete from pendaftaran_dokumen where pendaftaran_id=?').run(p.id);
    db.prepare(`update pendaftaran_ormas set status='ditolak',logo_key=null,catatan=?,updated_at=? where id=?`).run(String(req.body?.catatan || '').trim().slice(0, 500), now(), p.id);
  })();
  log(req, 'tolak_pendaftaran', null, `Menolak pendaftaran ormas baru: ${p.nama_ormas}`);
  res.json({ ok: true });
});

// --- Verifikasi perubahan dari portal ormas ---
app.post('/api/admin/ormas/:id/verify', auth('manage_ormas'), async (req, res) => {
  const id = +req.params.id;
  const o = db.prepare('select * from ormas where id=?').get(id);
  if (!o) return res.status(404).json({ error: 'Data tidak ditemukan' });
  const pd = pendingOf(id);
  if (!pd) return res.status(400).json({ error: 'Tidak ada perubahan yang menunggu verifikasi' });
  const pdocs = db.prepare('select * from dokumen_ormas where ormas_id=? and pending=1').all(id);
  const uploaded = []; // id file Drive yang sudah dibuat, dibatalkan jika ada yang gagal
  const moved = [];    // berkas lokal yang sudah dipindah ke folder resmi, dikembalikan jika gagal
  const newKey = new Map();
  let logoNewKey = null;
  try {
    for (const d of pdocs) {
      const src = path.join(PENDING, path.basename(d.storage_key));
      if (!fs.existsSync(src)) throw new Error(`Berkas "${d.nama_file}" tidak ditemukan di penyimpanan sementara`);
      if (driveOn()) { const gid = await driveUpload(src, `${DOC_TYPES[d.jenis_dokumen] || 'Dokumen'} - ${d.nama_file}`, { kind: 'pdf', mime: docMime(d.jenis_dokumen, d.nama_file) }); uploaded.push(gid); newKey.set(d.id, 'gd:' + gid); }
      else { const dst = path.join(FILES, path.basename(d.storage_key)); fs.renameSync(src, dst); moved.push([dst, src]); newKey.set(d.id, d.storage_key); }
    }
    if (pd.logo_key) {
      const src = path.join(PENDING, path.basename(pd.logo_key));
      if (!fs.existsSync(src)) throw new Error('Logo baru tidak ditemukan di penyimpanan sementara');
      if (driveOn()) { const gid = await driveUpload(src, `Logo - ${pd.logo_nama || 'logo'}`, { kind: 'logo', mime: sniffImg(src) }); uploaded.push(gid); logoNewKey = 'gd:' + gid; }
      else { const dst = path.join(LOGOS, path.basename(pd.logo_key)); fs.renameSync(src, dst); moved.push([dst, src]); logoNewKey = pd.logo_key; }
    }
  } catch (e) {
    uploaded.forEach((g) => driveDelete(g));
    moved.forEach(([dst, src]) => { try { fs.renameSync(dst, src); } catch {} });
    console.error('Gagal memverifikasi perubahan:', e.message);
    return res.status(502).json({ error: `Perubahan gagal diterapkan: ${e.message}. Data lama tidak berubah, silakan coba lagi.` });
  }
  const oldDocs = [];
  try {
    db.transaction(() => {
      const cols = Object.keys(pd.data).filter((k) => PORTAL_FIELDS.includes(k));
      for (const d of pdocs) {
        db.prepare('select * from dokumen_ormas where ormas_id=? and pending=0 and jenis_dokumen=?').all(id, d.jenis_dokumen).forEach((x) => { oldDocs.push(x); db.prepare('delete from dokumen_ormas where id=?').run(x.id); });
        db.prepare('update dokumen_ormas set storage_key=?,pending=0,uploaded_by=?,uploaded_at=? where id=?').run(newKey.get(d.id), req.admin.id, now(), d.id);
      }
      const jumlah = db.prepare(`select count(distinct jenis_dokumen) c from dokumen_ormas where ormas_id=? and pending=0 and jenis_dokumen is not null and jenis_dokumen not in ('dokumentasi','adart','company_profile')`).get(id).c;
      const prev = pd.status_sebelumnya;
      const status = !prev || prev === 'Perlu Diverifikasi' || prev === 'Belum Lengkap' ? (jumlah >= REQ_DOCS.length ? 'Lengkap' : 'Belum Lengkap') : prev;
      const logoVal = logoNewKey || (pd.remove_logo ? null : o.logo_key);
      db.prepare(`update ormas set ${cols.map((k) => k + '=?').join(',')}${cols.length ? ',' : ''}status_dokumen=?,logo_key=?,catatan_penolakan='',updated_at=?,updated_by=? where id=?`)
        .run(...cols.map((k) => (INT_FIELDS.includes(k) ? (String(pd.data[k] ?? '') === '' ? null : +pd.data[k]) : String(pd.data[k] ?? ''))), status, logoVal, now(), req.admin.id, id);
      db.prepare('delete from perubahan_ormas where ormas_id=?').run(id);
    })();
  } catch (e) {
    uploaded.forEach((g) => driveDelete(g));
    moved.forEach(([dst, src]) => { try { fs.renameSync(dst, src); } catch {} });
    console.error('Gagal menyimpan verifikasi:', e.message);
    return res.status(500).json({ error: 'Perubahan gagal disimpan. Data lama tidak berubah.' });
  }
  oldDocs.forEach((d) => removeStored(d.storage_key));
  if (driveOn()) { pdocs.forEach((d) => unlink(PENDING, d.storage_key)); if (pd.logo_key) unlink(PENDING, pd.logo_key); }
  if ((logoNewKey || pd.remove_logo) && o.logo_key) removeLogoFile(o.logo_key);
  organizeOrmas(id);
  log(req, 'verifikasi_perubahan', id, `Memverifikasi perubahan dari ormas ${o.kode_ormas}`);
  notifAdmin(req, `Memverifikasi perubahan dari ${o.kode_ormas} (${o.nama_ormas})`, id);
  res.json({ ok: true });
});

app.post('/api/admin/ormas/:id/reject', auth('manage_ormas'), (req, res) => {
  const id = +req.params.id;
  const o = db.prepare('select * from ormas where id=?').get(id);
  if (!o) return res.status(404).json({ error: 'Data tidak ditemukan' });
  const pd = pendingOf(id);
  if (!pd) return res.status(400).json({ error: 'Tidak ada perubahan yang menunggu verifikasi' });
  const catatan = String(req.body?.catatan || '').trim().slice(0, 900);
  const pdocs = db.prepare('select * from dokumen_ormas where ormas_id=? and pending=1').all(id);
  db.transaction(() => {
    pdocs.forEach((d) => db.prepare('delete from dokumen_ormas where id=?').run(d.id));
    db.prepare('delete from perubahan_ormas where ormas_id=?').run(id);
    db.prepare('update ormas set status_dokumen=?,catatan_penolakan=?,updated_at=?,updated_by=? where id=?').run(pd.status_sebelumnya || 'Belum Lengkap', catatan, now(), req.admin.id, id);
  })();
  pdocs.forEach((d) => removeStored(d.storage_key, true));
  if (pd.logo_key) unlink(PENDING, pd.logo_key);
  log(req, 'tolak_perubahan', id, `Menolak perubahan dari ormas ${o.kode_ormas}${catatan ? ': ' + catatan : ''}`);
  notifAdmin(req, `Menolak perubahan dari ${o.kode_ormas} (${o.nama_ormas})`, id);
  res.json({ ok: true });
});

app.delete('/api/admin/ormas/:id', auth('manage_ormas'), (req, res) => {
  const o = db.prepare('select * from ormas where id=?').get(+req.params.id);
  if (!o) return res.status(404).json({ error: 'Data tidak ditemukan' });
  const docs = db.prepare('select storage_key,pending from dokumen_ormas where ormas_id=?').all(o.id);
  const pl = db.prepare('select logo_key from perubahan_ormas where ormas_id=?').get(o.id);
  db.prepare('delete from ormas where id=?').run(o.id);
  docs.forEach((d) => removeStored(d.storage_key, !!d.pending)); removeLogoFile(o.logo_key);
  if (pl?.logo_key) unlink(PENDING, pl.logo_key);
  if (driveOn()) driveDeleteFolder(o.kode_ormas); // folder ormas ikut dibuang ke Sampah Drive
  log(req, 'hapus_ormas', null, `Menghapus ${o.kode_ormas}: ${o.nama_ormas}`);
  notifAdmin(req, `Menghapus ${o.kode_ormas}: ${o.nama_ormas}`, null);
  res.json({ ok: true });
});

app.get('/api/admin/files/:id', auth('view_docs'), (req, res) => {
  const d = db.prepare('select * from dokumen_ormas where id=?').get(+req.params.id);
  if (!d) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
  sendPdf(req, res, d, req.query.dl === '1', 'akses_dokumen_admin');
});

// --- Password harian ---
app.get('/api/admin/credentials', auth('view_credentials'), (req, res) => {
  ensureAll();
  const rows = db.prepare(`select o.id,o.kode_ormas,o.nama_ormas,k.nama_kategori,c.username,c.tanggal_berlaku,c.tanggal_kedaluwarsa,c.created_at,c.status from ormas o join kategori k on k.id=o.kategori_id left join kredensial_harian c on c.ormas_id=o.id and c.tanggal_berlaku=? and c.status='aktif' order by o.id`).all(today());
  res.json({ server_time: now(), items: rows.map((r) => ({ ...r, status: r.status === 'aktif' && new Date(r.tanggal_kedaluwarsa) > new Date() ? 'aktif' : 'kedaluwarsa' })) });
});
const todayCred = (id) => { ensureOne(id); return db.prepare(`select * from kredensial_harian where ormas_id=? and tanggal_berlaku=? and status='aktif'`).get(id, today()); };
app.get('/api/admin/credentials/:id/reveal', auth('manage_credentials'), (req, res) => {
  const c = todayCred(+req.params.id); if (!c) return res.status(404).json({ error: 'Kredensial tidak ditemukan' });
  log(req, 'lihat_kredensial', c.ormas_id, 'Menampilkan password harian');
  res.json({ username: c.username, password: dec(c.password_enc) });
});
app.post('/api/admin/credentials/:id/regenerate', auth('manage_credentials'), (req, res) => {
  const id = +req.params.id; if (!db.prepare('select 1 from ormas where id=?').get(id)) return res.status(404).json({ error: 'Data tidak ditemukan' });
  makeCred(id); const c = todayCred(id); // kredensial lama berstatus 'diganti', sehingga sesi PDF ormas yang sedang terbuka langsung tidak sah
  log(req, 'regenerasi_kredensial', id, 'Regenerasi kredensial harian');
  const oo = db.prepare('select kode_ormas,nama_ormas from ormas where id=?').get(id);
  notifAdmin(req, `Membuat ulang password harian ${oo.kode_ormas} (${oo.nama_ormas}). Sesi PDF ormas yang sedang terbuka ditutup.`, id);
  res.json({ username: c.username, password: dec(c.password_enc) });
});

// --- Ekspor ---
const sendXlsx = async (res, name, header, rows) => {
  try {
    const kred = name.startsWith('kredensial');
    const title = kred ? 'DAFTAR KREDENSIAL HARIAN ORMAS' : 'DATA ORGANISASI KEMASYARAKATAN (ORMAS)';
    const cols = header.length + 1, A = (n) => ({ style: 'thin', color: { argb: 'FF94A3B8' } });
    const wb = new ExcelJS.Workbook(); wb.creator = 'SIDOMAS';
    const ws = wb.addWorksheet(kred ? 'Kredensial' : 'Data Ormas', {
      views: [{ state: 'frozen', ySplit: 4 }],
      pageSetup: { paperSize: header.length > 12 ? 8 : 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, printTitlesRow: '4:4', margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
      headerFooter: { oddFooter: '&LSIDOMAS - Bidang Poldagri&CHalaman &P dari &N&RDicetak &D' },
    });
    ws.mergeCells(1, 1, 1, cols); Object.assign(ws.getCell(1, 1), { value: title }); ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF0B2250' } };
    ws.mergeCells(2, 1, 2, cols); ws.getCell(2, 1).value = `Bidang Poldagri - Tanggal cetak: ${new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long' })} - Jumlah data: ${rows.length}`; ws.getCell(2, 1).font = { size: 10, color: { argb: 'FF475569' } };
    const data = [['No', ...header], ...rows.map((r, i) => [i + 1, ...r.map((v) => (v == null ? '' : String(v)))])];
    data.forEach((r, i) => ws.getRow(4 + i).values = r);
    ws.getColumn(1).width = 5;
    header.forEach((h, c) => { const m = Math.max(h.length * 0.9, ...rows.map((r) => String(r[c] ?? '').length)); ws.getColumn(c + 2).width = Math.min(42, Math.max(10, Math.ceil(m) + 2)); });
    data.forEach((_, i) => { const row = ws.getRow(4 + i); row.eachCell({ includeEmpty: true }, (cell, n) => {
      cell.border = { top: A(), left: A(), bottom: A(), right: A() };
      cell.alignment = { vertical: i ? 'top' : 'middle', horizontal: i === 0 || n === 1 ? 'center' : 'left', wrapText: true };
      if (i === 0) { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2250' } }; }
      else if (i % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    }); });
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: cols } };
    const buf = await wb.xlsx.writeBuffer();
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' });
    res.send(Buffer.from(buf));
  } catch (e) { console.error(e.message); if (!res.headersSent) res.status(500).json({ error: 'Gagal membuat file Excel' }); }
};
app.get('/api/admin/export/ormas', auth('export'), (req, res) => {
  const { items } = listOrmas(req.query, { paginate: false });
  log(req, 'ekspor_csv', null, `Ekspor Excel ${items.length} data ormas`);
  sendXlsx(res, `data-ormas-${today()}.xlsx`,
    ['ID Ormas', 'Nama Ormas', 'Bidang (Kategori)', 'Bentuk', 'Bidang Kegiatan', 'Kemantren', 'Alamat Kantor/Sekretariat', 'Nomor Telepon', 'Email Ormas', 'Ketua', 'Sekretaris', 'Bendahara', 'Legal Standing - Jenis', 'Legal Standing - Nomor', 'Legal Standing - Tahun', 'Legal Standing - Berlaku s/d', 'SKTO - Nomor', 'SKTO - Tahun', 'SKTO - Berlaku s/d', 'Status Validasi', 'Jumlah Anggota', 'Anggota Perempuan', 'Anggota Lansia', 'Anggota Disabilitas', 'Link Dokumentasi', 'Instagram', 'Status Dokumen', 'Status Operasional', 'Status Publikasi', 'Dokumen Wajib Terunggah (dari 5)', 'Tanggal Dibuat', 'Tanggal Diperbarui'],
    items.map((o) => [o.kode_ormas, o.nama_ormas, o.nama_kategori, o.bentuk, o.bidang_kegiatan, o.kemantren, o.alamat, o.nomor_whatsapp_ketua, o.email_ormas, o.nama_ketua, o.sekretaris, o.bendahara, o.legal_jenis, o.nomor_sk, o.legal_tahun, o.legal_berlaku_sd, o.skto_nomor, o.skto_tahun, o.skto_berlaku_sd, o.validasi, o.anggota_total, o.anggota_perempuan, o.anggota_lansia, o.anggota_disabilitas, o.link_dokumentasi, o.link_instagram, o.status_dokumen, o.status_operasional, o.status_publikasi, o.jumlah_dok, o.created_at, o.updated_at]));
});
app.get('/api/admin/export/credentials', auth('export_credentials'), (req, res) => {
  if (req.query.confirm !== 'yes') return res.status(400).json({ error: 'Konfirmasi diperlukan' });
  ensureAll();
  const rows = db.prepare(`select o.kode_ormas,o.nama_ormas,c.* from ormas o join kredensial_harian c on c.ormas_id=o.id and c.tanggal_berlaku=? and c.status='aktif' order by o.id`).all(today());
  log(req, 'ekspor_kredensial', null, `Ekspor ${rows.length} kredensial harian`);
  sendXlsx(res, `kredensial-ormas-${today()}.xlsx`, ['ID Ormas', 'Nama Ormas', 'Username', 'Password', 'Berlaku', 'Kedaluwarsa'], rows.map((r) => [r.kode_ormas, r.nama_ormas, r.username, dec(r.password_enc), r.tanggal_berlaku, r.tanggal_kedaluwarsa]));
});

// --- Log ---
app.get('/api/admin/logs', auth('view_logs'), (req, res) => {
  const page = Math.max(1, +req.query.page || 1), size = 25, t = `%${req.query.q || ''}%`;
  const w = `where (ringkasan like ? or nama_pengguna like ? or jenis_aktivitas like ?)`;
  const total = db.prepare(`select count(*) c from log_aktivitas ${w}`).get(t, t, t).c;
  const items = db.prepare(`select l.*,o.kode_ormas from log_aktivitas l left join ormas o on o.id=l.ormas_id ${w.replace(/ringkasan|nama_pengguna|jenis_aktivitas/g, (m) => 'l.' + m)} order by l.id desc limit ? offset ?`).all(t, t, t, size, (page - 1) * size);
  res.json({ items, total, page, pageSize: size });
});

// --- Manajemen admin ---
const superCount = (exceptId) => db.prepare(`select a.id,r.permissions from admin a join roles r on r.id=a.role_id where a.status_akun='aktif' and a.id!=?`).all(exceptId).filter((x) => JSON.parse(x.permissions).includes('manage_admins')).length;
app.get('/api/admin/accounts', auth('manage_admins'), (req, res) => res.json({
  items: db.prepare('select a.id,a.nama,a.username,a.email,a.role_id,r.nama_role,a.status_akun,a.last_login,a.created_at from admin a join roles r on r.id=a.role_id order by a.id').all(),
  roles: db.prepare('select id,nama_role from roles').all(),
}));
const validAcc = (b, creating) => {
  if (!String(b.nama || '').trim()) return 'Nama lengkap wajib diisi';
  if (creating && !/^[a-zA-Z0-9._-]{3,30}$/.test(b.username || '')) return 'Username 3-30 karakter (huruf, angka, titik, strip, garis bawah)';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email || '')) return 'Email tidak valid';
  if (!db.prepare('select 1 from roles where id=?').get(+b.role_id)) return 'Role tidak valid';
  if ((creating || b.password) && !validPassword(b.password, [b.username, b.email])) return PW_MSG;
  return null;
};
app.post('/api/admin/accounts', auth('manage_admins'), (req, res) => {
  const b = req.body || {}, err = validAcc(b, true); if (err) return res.status(400).json({ error: err });
  try {
    const id = db.prepare('insert into admin(nama,username,email,password_hash,role_id,must_change,created_at,updated_at) values(?,?,?,?,?,1,?,?)').run(b.nama.trim(), b.username, b.email.trim().toLowerCase(), bcrypt.hashSync(b.password, 10), +b.role_id, now(), now()).lastInsertRowid;
    log(req, 'tambah_admin', null, `Menambah akun ${b.username}`); notifAdmin(req, `Menambah akun admin ${b.username}`); res.json({ id });
  } catch { res.status(400).json({ error: 'Username atau email sudah digunakan' }); }
});
app.put('/api/admin/accounts/:id', auth('manage_admins'), (req, res) => {
  const id = +req.params.id, b = req.body || {}, t = db.prepare('select a.*,r.permissions from admin a join roles r on r.id=a.role_id where a.id=?').get(id);
  if (!t) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  const err = validAcc({ ...b, username: t.username }, false); if (err) return res.status(400).json({ error: err });
  const status = b.status_akun === 'nonaktif' ? 'nonaktif' : 'aktif';
  const newSuper = JSON.parse(db.prepare('select permissions from roles where id=?').get(+b.role_id).permissions).includes('manage_admins');
  if (JSON.parse(t.permissions).includes('manage_admins') && t.status_akun === 'aktif' && (!newSuper || status !== 'aktif') && superCount(id) === 0)
    return res.status(400).json({ error: 'Tidak dapat menonaktifkan atau menurunkan hak akses akun terakhir dengan kewenangan tertinggi' });
  try {
    db.prepare('update admin set nama=?,email=?,role_id=?,status_akun=?,updated_at=? where id=?').run(b.nama.trim(), b.email.trim().toLowerCase(), +b.role_id, status, now(), id);
    if (b.password) db.prepare('update admin set password_hash=?,must_change=1 where id=?').run(bcrypt.hashSync(b.password, 10), id);
  } catch { return res.status(400).json({ error: 'Email sudah digunakan' }); }
  if (+b.role_id !== t.role_id) log(req, 'ubah_role', null, `Mengubah role akun ${t.username}`);
  log(req, 'ubah_admin', null, `Mengubah akun ${t.username}${b.password ? ' (reset password)' : ''}${status !== t.status_akun ? ` (${status})` : ''}`);
  notifAdmin(req, `Mengubah akun admin ${t.username}${status !== t.status_akun ? ` (${status})` : ''}`);
  res.json({ ok: true });
});

app.delete('/api/admin/accounts/:id', auth('manage_admins'), (req, res) => {
  const id = +req.params.id, t = db.prepare('select a.*,r.permissions from admin a join roles r on r.id=a.role_id where a.id=?').get(id);
  if (!t) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  if (id === req.admin.id) return res.status(400).json({ error: 'Anda tidak dapat menghapus akun yang sedang Anda pakai' });
  if (JSON.parse(t.permissions).includes('manage_admins') && t.status_akun === 'aktif' && superCount(id) === 0)
    return res.status(400).json({ error: 'Tidak dapat menghapus akun terakhir dengan kewenangan tertinggi' });
  db.transaction(() => {
    db.prepare('update ormas set created_by=null where created_by=?').run(id);
    db.prepare('update ormas set updated_by=null where updated_by=?').run(id);
    db.prepare('update dokumen_ormas set uploaded_by=null where uploaded_by=?').run(id);
    db.prepare('delete from admin where id=?').run(id); // token reset ikut terhapus (cascade)
  })();
  log(req, 'hapus_admin', null, `Menghapus akun ${t.username}`);
  notifAdmin(req, `Menghapus akun admin ${t.username}`);
  res.json({ ok: true });
});

// --- Pengaturan ---
const SETTING_KEYS = ['app_name', 'max_pdf_mb', 'session_minutes', 'login_max_attempts', 'catalog_public', 'recovery_from'];
app.get('/api/admin/settings', auth('manage_settings'), (req, res) => res.json({
  settings: Object.fromEntries(SETTING_KEYS.map((k) => [k, S(k)])), timezone: 'Asia/Jakarta',
  categories: db.prepare('select * from kategori order by urutan,id').all(),
}));
app.put('/api/admin/settings', auth('manage_settings'), (req, res) => {
  const b = req.body || {}, rng = (k, lo, hi) => Number.isInteger(+b[k]) && +b[k] >= lo && +b[k] <= hi;
  if (!String(b.app_name || '').trim() || b.app_name.length > 80) return res.status(400).json({ error: 'Nama aplikasi wajib diisi (maks. 80 karakter)' });
  if (!rng('max_pdf_mb', 1, 100)) return res.status(400).json({ error: 'Batas ukuran PDF 1-100 MB' });
  if (!rng('session_minutes', 5, 1440)) return res.status(400).json({ error: 'Masa sesi 5-1440 menit' });
  if (!rng('login_max_attempts', 3, 50)) return res.status(400).json({ error: 'Batas percobaan login 3-50' });
  if (!/^[^@\s]+@[^@\s]+$/.test(b.recovery_from || '')) return res.status(400).json({ error: 'Email pengirim tidak valid' });
  db.transaction(() => SETTING_KEYS.forEach((k) => setSetting(k, k === 'catalog_public' ? (b[k] === true || b[k] === 'true') : String(b[k]).trim())))();
  log(req, 'ubah_pengaturan', null, 'Mengubah pengaturan sistem'); notifAdmin(req, 'Mengubah pengaturan sistem'); res.json({ ok: true });
});
app.put('/api/admin/categories', auth('manage_settings'), (req, res) => {
  const list = req.body?.items;
  if (!Array.isArray(list) || !list.length) return res.status(400).json({ error: 'Daftar kategori tidak boleh kosong' });
  const seen = new Set();
  for (const it of list) {
    const n = String(it?.nama_kategori || '').trim();
    if (!n || n.length > 80) return res.status(400).json({ error: 'Nama kategori wajib diisi (maks. 80 karakter)' });
    if (seen.has(n.toLowerCase())) return res.status(400).json({ error: `Kategori "${n}" tertulis ganda` });
    seen.add(n.toLowerCase());
  }
  const existing = db.prepare('select id,nama_kategori from kategori').all();
  const exIds = new Set(existing.map((x) => x.id));
  const keep = new Set(list.filter((i) => i.id && exIds.has(+i.id)).map((i) => +i.id));
  const removed = existing.filter((x) => !keep.has(x.id));
  for (const r of removed) {
    const c = db.prepare('select count(*) c from ormas where kategori_id=?').get(r.id).c;
    if (c) return res.status(400).json({ error: `Kategori "${r.nama_kategori}" dipakai ${c} ormas sehingga tidak bisa dihapus. Pindahkan ormasnya ke kategori lain, atau nonaktifkan saja.` });
  }
  try {
    db.transaction(() => {
      removed.forEach((r) => db.prepare('delete from kategori where id=?').run(r.id));
      keep.forEach((id) => db.prepare('update kategori set nama_kategori=? where id=?').run('__tmp_' + id, id)); // agar tukar nama tidak bentrok
      list.forEach((it, i) => {
        const n = String(it.nama_kategori).trim(), st = it.status_aktif === false || it.status_aktif === 0 ? 0 : 1;
        if (it.id && exIds.has(+it.id)) db.prepare('update kategori set nama_kategori=?,status_aktif=?,urutan=? where id=?').run(n, st, i + 1, +it.id);
        else db.prepare('insert into kategori(nama_kategori,status_aktif,urutan) values(?,?,?)').run(n, st, i + 1);
      });
    })();
  } catch { return res.status(400).json({ error: 'Gagal menyimpan kategori. Periksa nama yang ganda.' }); }
  log(req, 'ubah_pengaturan', null, `Mengubah daftar kategori (${list.length} kategori)`);
  notifAdmin(req, `Mengubah daftar kategori (${list.length} kategori)`);
  res.json({ ok: true, categories: db.prepare('select * from kategori order by urutan,id').all() });
});

// --- Fitur tambahan: notifikasi admin, notifikasi HP, dokumen kedaluwarsa, cek sesi PDF ---
setupFitur({ app, auth });

// ---------- Static & error ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));
const dist = path.join(__dirname, '../client/dist');
if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html'))); }
app.use((err, req, res, next) => { console.error(err.message); res.status(500).json({ error: 'Terjadi kesalahan pada server' }); });

console.log(driveOn() ? 'Penyimpanan PDF dan logo: Google Drive (backup database harian ke Drive aktif)' : 'Penyimpanan PDF dan logo: lokal (folder data/). Isi GDRIVE_URL dan GDRIVE_SECRET di .env untuk memakai Google Drive.');
if (!smtpOn()) console.warn('PERINGATAN: SMTP belum diatur di .env, email reset password TIDAK akan terkirim (tautan hanya dicetak di sini).');
if (driveOn()) {
  // Jika gagal (mis. internet putus sesaat) dicoba lagi 5, 15, dan 45 menit kemudian, tidak menunggu 6 jam berikutnya.
  const jalankanBackup = () => retry(() => backupDb(), [5 * 60000, 15 * 60000, 45 * 60000])
    .then((r) => r.id && console.log('Backup database ke Google Drive berhasil.'))
    .catch((e) => console.error('Backup database gagal setelah beberapa kali percobaan:', e.message));
  setTimeout(jalankanBackup, 90 * 1000); // sekali setelah server hidup, lalu dicek tiap 6 jam (maksimal 1 backup per 20 jam)
  setInterval(jalankanBackup, 6 * 3600 * 1000);
}
ensureAll();
setInterval(ensureAll, 60 * 60 * 1000); // scheduler; lazy rotation tetap berlaku sebagai cadangan
hd.purge(); setInterval(() => hd.purge(), 3600 * 1000).unref(); // bersihkan catatan token dicabut dan batas WhatsApp yang sudah lewat
setTimeout(cekKedaluwarsa, 20 * 1000); // pengingat SKTO / legal standing yang hampir atau sudah kedaluwarsa
setInterval(cekKedaluwarsa, 6 * 3600 * 1000);
app.listen(PORT, () => console.log(`SIDOMAS server berjalan di http://localhost:${PORT} [versi: v2 anggota + dokumentasi + notifikasi + kedaluwarsa + sesi-PDF]`));
