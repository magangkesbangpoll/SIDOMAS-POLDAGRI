// Batch 10 — Tracking pendaftaran, verifikasi dengan OTP email, revisi berbatas waktu, dan riwayat status.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { db, DATA_DIR, SECRET } from './db.js';
import { notify } from './fitur.js';

const PENDING = path.join(DATA_DIR, 'pending');
const COOKIE = 'trk';
const now = () => new Date().toISOString();
const HARI = 30 * 24 * 60 * 60 * 1000;
const OTP_MENIT = 10;

export const TRACK_LABELS = {
  nama_ormas: 'Nama ormas', kategori_nama: 'Kategori', bentuk: 'Bentuk ormas', bidang_kegiatan: 'Bidang kegiatan',
  kemantren: 'Kemantren', nama_ketua: 'Nama ketua', sekretaris: 'Sekretaris', bendahara: 'Bendahara',
  nomor_whatsapp_ketua: 'Telepon ketua', telepon_ormas: 'Telepon ormas', email_ormas: 'Email ormas', alamat: 'Alamat kantor',
  legal_status: 'Legal Standing', legal_jenis: 'Jenis legalitas', nomor_sk: 'Nomor SK', legal_tahun: 'Tahun legalitas', legal_berlaku_sd: 'Legal berlaku s/d',
  anggota_total: 'Total anggota', anggota_perempuan: 'Anggota perempuan', anggota_lansia: 'Anggota lansia', anggota_disabilitas: 'Anggota disabilitas',
  link_dokumentasi: 'Link dokumentasi', link_instagram: 'Instagram', link_youtube: 'YouTube', link_tiktok: 'TikTok', cp_bagian: 'Isian Company Profile',
};
export const DOK_LABELS = {
  sk_pengurusan: 'SK Pengurusan', surat_domisili: 'Surat Keterangan Domisili', program_kerja: 'Program Kerja',
  badan_hukum: 'Salinan Badan Hukum', skto: 'SKTO', adart: 'AD/ART', company_profile: 'Company Profile', dokumentasi: 'Dokumentasi Kegiatan',
};
const labelItem = (key) => key === 'logo' ? 'Logo / foto profil' : key.startsWith('dok:') ? (DOK_LABELS[key.slice(4)] || key.slice(4)) : (TRACK_LABELS[key] || key);

export const buatTrackingId = () => `TRK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(9).toString('base64url').toUpperCase()}`;
export const buatKodeAkses = () => crypto.randomBytes(18).toString('base64url');
export const buatOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
export const hashAkses = (t) => crypto.createHmac('sha256', SECRET).update(String(t || '')).digest('hex');
const DUMMY_HASH = hashAkses('tracking-dummy');

const sama = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export function catatRiwayat(pendaftaranId, status, label, catatan = null, oleh = 'sistem') {
  db.prepare('insert into pendaftaran_riwayat(pendaftaran_id,status,label,catatan,oleh,created_at) values(?,?,?,?,?,?)')
    .run(pendaftaranId, status, label, catatan ? String(catatan).slice(0, 900) : null, oleh, now());
}

// Dipanggil sekali saat pendaftaran berhasil dikirim. Tracking ID tampil; akses masuk memakai OTP email.
// Hash acak ini sengaja tidak diberikan ke siapa pun — tidak ada "kode akses" yang perlu disalin ormas.
export function terbitkanAkses(pendaftaranId) {
  const trackingId = buatTrackingId();
  const hashTakDipakai = hashAkses(buatKodeAkses());
  db.prepare('update pendaftaran_ormas set tracking_id=?,akses_token_hash=?,tracking_gagal=0,tracking_locked_until=null where id=?')
    .run(trackingId, hashTakDipakai, pendaftaranId);
  return { tracking_id: trackingId };
}

export function siapkanItemPendaftaran(pendaftaranId, data = {}, jenisDok = [], logoKey = null, logoNama = null) {
  const keys = ['nama_ormas', ...Object.keys(TRACK_LABELS).filter((k) => Object.prototype.hasOwnProperty.call(data, k)), ...jenisDok.map((j) => `dok:${j}`)];
  if (logoKey) keys.push('logo');
  const ins = db.prepare('insert or ignore into pendaftaran_item(pendaftaran_id,item_key,status,catatan,updated_at) values(?,?,\'pending\',null,?)');
  const t = now();
  for (const k of [...new Set(keys)]) ins.run(pendaftaranId, k, t);
  if (logoNama && !keys.includes('logo')) {
    // logo tanpa berkas tidak perlu dibuat item
  }
}

export const statusLabel = (p) => ({
  tindaklanjuti: p.revisi_count ? 'Menunggu Pemeriksaan Ulang' : 'Tindak Lanjuti',
  dikembalikan: 'Dikembalikan',
  disetujui: 'Disetujui',
  ditolak: 'Ditolak',
  hangus: 'Hangus / Kedaluwarsa',
}[p.status] || p.status);

export function countdown(iso) {
  const ms = Math.max(0, Date.parse(iso || '') - Date.now());
  const s = Math.floor(ms / 1000);
  const hari = Math.floor(s / 86400), jam = Math.floor((s % 86400) / 3600), menit = Math.floor((s % 3600) / 60), detik = s % 60;
  return { ms, hari, jam, menit, detik, habis: ms === 0, teks: `${hari} hari ${String(jam).padStart(2, '0')}:${String(menit).padStart(2, '0')}:${String(detik).padStart(2, '0')}` };
}

export function detailPendaftaran(p) {
  const data = typeof p.data === 'string' ? JSON.parse(p.data || '{}') : (p.data || {});
  const docs = db.prepare('select id,jenis,nama_file,storage_key,ukuran from pendaftaran_dokumen where pendaftaran_id=? order by id').all(p.id);
  const items = db.prepare('select item_key,status,catatan,updated_at from pendaftaran_item where pendaftaran_id=? order by id').all(p.id).map((it) => {
    const dokumen = it.item_key.startsWith('dok:') ? docs.find((d) => d.jenis === it.item_key.slice(4)) : null;
    const nilai = it.item_key === 'kategori_nama' ? (p.kategori_nama || '')
      : it.item_key === 'logo' ? (p.logo_nama || '')
      : dokumen ? dokumen.nama_file : (data[it.item_key] ?? '');
    const isDok = !!dokumen;
    return {
      key: it.item_key,
      label: labelItem(it.item_key),
      jenis: isDok ? 'dokumen' : it.item_key === 'logo' ? 'logo' : 'data',
      nilai: nilai == null ? '' : String(nilai),
      status: it.status,
      catatan: it.catatan || '',
      ukuran: dokumen?.ukuran || null,
      dokumen_id: dokumen?.id || null,
      // Dipakai ormas lewat sesi tracking (cookie trk).
      url: dokumen ? `/api/public/tracking/dokumen/${dokumen.id}` : null,
      terkunci: it.status === 'terverifikasi',
      bisa_diedit: false,
    };
  });
  const riwayat = db.prepare('select status,label,catatan,oleh,created_at from pendaftaran_riwayat where pendaftaran_id=? order by id desc').all(p.id);
  return { ...p, data, docs, items, riwayat, status_label: statusLabel(p), has_logo: !!p.logo_key };
}

function payloadTracking(p) {
  const d = detailPendaftaran(p);
  const bisaRevisi = p.status === 'dikembalikan' && !!p.batas_revisi && Date.now() < Date.parse(p.batas_revisi);
  const items = d.items.map((x) => ({ ...x, bisa_diedit: x.status === 'revisi' && bisaRevisi }));
  const terverifikasi = items.filter((x) => x.status === 'terverifikasi').length;
  let progress = items.length ? Math.round((terverifikasi / items.length) * 100) : 10;
  if (p.status === 'disetujui' || p.status === 'hangus') progress = 100;
  else if (p.status === 'dikembalikan') progress = Math.max(15, Math.min(85, progress));
  else if (p.status === 'tindaklanjuti') progress = Math.max(20, Math.min(95, progress));
  return {
    nama_ormas: p.nama_ormas,
    tracking_id: p.tracking_id,
    tanggal_daftar: p.created_at,
    status: p.status,
    status_label: d.status_label,
    progress,
    catatan_admin: p.catatan || '',
    tanggal_dikembalikan: p.tanggal_dikembalikan || null,
    batas_revisi: p.batas_revisi || null,
    countdown: p.batas_revisi ? countdown(p.batas_revisi) : null,
    bisa_revisi: bisaRevisi,
    revisi_count: p.revisi_count || 0,
    izin_khusus: !!p.izin_khusus,
    items,
    riwayat: d.riwayat,
  };
}

let D = {};
const attempts = new Map();
const kunciAttempt = (req, id) => `${req.ip || '?'}|${String(id || '').trim().toUpperCase()}`;
function cekAttempt(req, res, next) {
  const a = attempts.get(kunciAttempt(req, req.body?.tracking_id));
  if (a?.until && Date.now() < a.until) return res.status(429).json({ error: 'Terlalu banyak percobaan verifikasi. Silakan coba lagi beberapa menit lagi.' });
  next();
}
function gagalAttempt(req, id) {
  const k = kunciAttempt(req, id), a = attempts.get(k) || { n: 0, until: 0 };
  a.n += 1;
  if (a.n >= 5) { a.until = Date.now() + 15 * 60 * 1000; a.n = 0; }
  attempts.set(k, a);
  const p = db.prepare('select id from pendaftaran_ormas where tracking_id=?').get(String(id || '').trim().toUpperCase());
  if (p) db.prepare('update pendaftaran_ormas set tracking_gagal=coalesce(tracking_gagal,0)+1,tracking_locked_until=? where id=?').run(a.until ? new Date(a.until).toISOString() : null, p.id);
}
function suksesAttempt(req, id) {
  attempts.delete(kunciAttempt(req, id));
  const p = db.prepare('select id from pendaftaran_ormas where tracking_id=?').get(String(id || '').trim().toUpperCase());
  if (p) db.prepare('update pendaftaran_ormas set tracking_gagal=0,tracking_locked_until=null where id=?').run(p.id);
}

function setTrackCookie(res, pid) {
  const token = jwt.sign({ p: pid, scope: 'tracking', jti: crypto.randomBytes(8).toString('hex') }, SECRET, { expiresIn: '30m' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: 30 * 60 * 1000 });
}
function getTrack(req) {
  try {
    const v = jwt.verify(req.cookies?.[COOKIE] || '', SECRET);
    if (v?.scope !== 'tracking') return null;
    return db.prepare('select id from pendaftaran_ormas where id=?').get(v.p)?.id || null;
  } catch { return null; }
}
const requireTrack = (req, res, next) => {
  const pid = getTrack(req);
  if (!pid) return res.status(401).json({ error: 'Sesi tracking tidak valid. Silakan verifikasi ulang.' });
  req.trackingId = pid;
  next();
};

const bersihkanUpload = (req) => Object.values(req.files || {}).flat().forEach((f) => fs.rm(f.path, { force: true }, () => {}));
const hapusPending = (key) => key && fs.rm(path.join(PENDING, path.basename(String(key))), { force: true }, () => {});
function kirimBerkas(req, res, key, nama, mime = 'application/pdf') {
  if (!key) return res.status(404).json({ error: 'Berkas tidak ditemukan' });
  const p = path.join(PENDING, path.basename(String(key)));
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Berkas tidak ditemukan' });
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `${req.query.dl === '1' ? 'attachment' : 'inline'}; filename="${String(nama || 'dokumen').replace(/["\r\n]/g, '_')}"` });
  res.type(mime || 'application/pdf').sendFile(p);
}

function notifPendaftar(p, judul, pesan) {
  const data = typeof p.data === 'string' ? JSON.parse(p.data || '{}') : (p.data || {});
  const ke = String(data.nomor_whatsapp_ketua || data.telepon_ormas || '');
  try { if (D.sendWA && ke) D.sendWA(ke, `${judul}\n${pesan}\nTracking ID: ${p.tracking_id}`); }
  catch (e) { console.error('Gagal mengirim notifikasi pendaftar:', e.message); }
  try { if (D.sendMail && data.email_ormas) D.sendMail(String(data.email_ormas).trim(), judul, `${pesan}\nTracking ID: ${p.tracking_id}\nCek status di halaman Tracking Pendaftaran.`); }
  catch (e) { console.error('Gagal mengirim email pendaftar:', e.message); }
}

const dataPendaftar = (p) => typeof p.data === 'string' ? JSON.parse(p.data || '{}') : (p.data || {});
const emailPendaftar = (p) => String(dataPendaftar(p).email_ormas || '').trim();
const waPendaftar = (p) => {
  const d = dataPendaftar(p);
  return String(d.nomor_whatsapp_ketua || d.telepon_ormas || '').trim();
};

const otpCooldown = new Map();

// Dua kanal OTP: email atau WhatsApp. Hash OTP sama, jadi OTP terakhir yang dikirim yang berlaku.
// paksa=true dipakai admin; jalur publik dibatasi 1 OTP / menit per kanal per Tracking ID.
async function terbitkanDanKirimOtp(p, kanal, paksa = false) {
  const tujuan = kanal === 'wa' ? waPendaftar(p) : emailPendaftar(p);
  const pengirim = kanal === 'wa' ? D.sendWA : D.sendMail;
  if (!tujuan || !pengirim) return false;
  const kunci = `${kanal}:${p.id}`;
  const terakhir = otpCooldown.get(kunci) || 0;
  if (!paksa && Date.now() - terakhir < 60 * 1000) return true;
  const otp = buatOtp();
  db.prepare('update pendaftaran_ormas set otp_hash=?,otp_expired=?,otp_gagal=0 where id=?')
    .run(hashAkses(otp), new Date(Date.now() + OTP_MENIT * 60000).toISOString(), p.id);
  otpCooldown.set(kunci, Date.now());
  const isi = `Kode OTP untuk melacak pendaftaran ${p.nama_ormas}: ${otp}\nBerlaku ${OTP_MENIT} menit. Jangan bagikan kode ini.\nTracking ID: ${p.tracking_id}\nBuka halaman /tracking untuk verifikasi.\nAbaikan pesan ini bila Anda tidak meminta OTP.`;
  if (kanal === 'wa') {
    if (!process.env.WA_TOKEN && process.env.NODE_ENV !== 'production') {
      console.log(`\n[OTP WHATSAPP LOKAL — WA_TOKEN belum diatur, TIDAK terkirim]\nTracking ID: ${p.tracking_id}\nOTP: ${otp}\nBerlaku ${OTP_MENIT} menit.\n`);
    }
    return !!(await pengirim(tujuan, isi, { otp: true }));
  }
  if (!process.env.SMTP_HOST && process.env.NODE_ENV !== 'production') {
    console.log(`\n[OTP EMAIL LOKAL — SMTP belum diatur, TIDAK terkirim ke email]\nTracking ID: ${p.tracking_id}\nOTP: ${otp}\nBerlaku ${OTP_MENIT} menit.\n`);
  }
  return !!(await pengirim(tujuan, `Kode OTP Tracking SIDOMAS — ${p.tracking_id}`, `Halo ${p.nama_ormas},\n\n${isi}\n\nJika Anda tidak meminta OTP, abaikan email ini.`));
}

export const kirimOtpEmail = (p, paksa = false) => terbitkanDanKirimOtp(p, 'email', paksa);
export const kirimOtpWa = (p, paksa = false) => terbitkanDanKirimOtp(p, 'wa', paksa);

export function setupTracking(deps) {
  D = deps;
  const limiter = deps.limiter, auth = deps.auth, uploadPending = deps.uploadPending;

  // ----- Sisi ormas / publik -----
  // Kirim OTP ke email ATAU WhatsApp. Response generik agar tidak membocorkan keberadaan Tracking ID.
  appPost('/api/public/tracking/otp', limiter({ limit: 10 }), async (req, res) => {
    const id = String(req.body?.tracking_id || '').trim().toUpperCase();
    const kanal = req.body?.channel === 'wa' ? 'wa' : 'email';
    const p = db.prepare('select * from pendaftaran_ormas where tracking_id=?').get(id);
    const terkunci = p?.tracking_locked_until && Date.parse(p.tracking_locked_until) > Date.now();
    if (p && !terkunci) {
      try { await (kanal === 'wa' ? kirimOtpWa(p) : kirimOtpEmail(p)); }
      catch (e) { console.error('Gagal mengirim OTP tracking:', e.message); }
    }
    res.json({ ok: true, message: `Jika Tracking ID terdaftar, Kode OTP telah dikirim ke ${kanal === 'wa' ? 'WhatsApp' : 'email'} yang tersimpan.` });
  });

  appPost('/api/public/tracking/verify', limiter({ limit: 20 }), cekAttempt, (req, res) => {
    const id = String(req.body?.tracking_id || '').trim().toUpperCase();
    const otp = String(req.body?.otp || '').replace(/\D/g, '').slice(0, 6);
    const p = db.prepare('select * from pendaftaran_ormas where tracking_id=?').get(id);
    const terkunci = p?.tracking_locked_until && Date.parse(p.tracking_locked_until) > Date.now();
    const otpMasihBerlaku = !!p?.otp_hash && !!p?.otp_expired && Date.parse(p.otp_expired) > Date.now();
    const otpCocok = otp.length === 6 && otpMasihBerlaku && !(p.otp_gagal >= 5) && sama(hashAkses(otp), p.otp_hash);
    if (!p || terkunci || !otpCocok) {
      if (p) db.prepare('update pendaftaran_ormas set otp_gagal=coalesce(otp_gagal,0)+1 where id=?').run(p.id);
      gagalAttempt(req, id);
      return res.status(401).json({ error: 'Tracking ID atau Kode OTP tidak valid.' });
    }
    suksesAttempt(req, id);
    db.prepare('update pendaftaran_ormas set otp_hash=null,otp_expired=null,otp_gagal=0 where id=?').run(p.id);
    setTrackCookie(res, p.id);
    res.json({ ok: true });
  });

  appGet('/api/public/tracking', requireTrack, (req, res) => {
    const p = db.prepare('select * from pendaftaran_ormas where id=?').get(req.trackingId);
    if (!p) return res.status(401).json({ error: 'Sesi tracking tidak valid.' });
    res.set('Cache-Control', 'no-store');
    res.json(payloadTracking(p));
  });

  appPost('/api/public/tracking/keluar', (req, res) => {
    res.clearCookie(COOKIE, { sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true' });
    res.json({ ok: true });
  });

  appGet('/api/public/tracking/dokumen/:id', requireTrack, (req, res) => {
    const d = db.prepare('select * from pendaftaran_dokumen where id=? and pendaftaran_id=?').get(+req.params.id, req.trackingId);
    if (!d) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    kirimBerkas(req, res, d.storage_key, d.nama_file, /\.pptx?$/i.test(d.nama_file) ? 'application/octet-stream' : 'application/pdf');
  });

  appPut('/api/public/tracking/revisi', requireTrack, uploadPending, (req, res) => {
    const p = db.prepare('select * from pendaftaran_ormas where id=?').get(req.trackingId);
    const terlambat = !p || p.status !== 'dikembalikan' || !p.batas_revisi || Date.now() > Date.parse(p.batas_revisi);
    if (terlambat) { bersihkanUpload(req); return res.status(400).json({ error: 'Batas waktu revisi sudah berakhir atau pengajuan tidak dalam masa revisi.' }); }
    let perubahan = {};
    try { perubahan = JSON.parse(String(req.body?.perubahan || '{}')); }
    catch { bersihkanUpload(req); return res.status(400).json({ error: 'Format data revisi tidak valid.' }); }
    const items = db.prepare('select item_key,status from pendaftaran_item where pendaftaran_id=?').all(p.id);
    const boleh = new Set(items.filter((i) => i.status === 'revisi').map((i) => i.item_key));
    const data = typeof p.data === 'string' ? JSON.parse(p.data || '{}') : (p.data || {});
    const diubah = new Set();
    let logoKey = p.logo_key, logoNama = p.logo_nama;

    for (const [k, v] of Object.entries(perubahan)) {
      if (!boleh.has(k)) continue; // item terverifikasi/pending sengaja diabaikan: tetap terkunci
      data[k] = String(v ?? '').trim().slice(0, 5000);
      diubah.add(k);
    }
    for (const [field, arr] of Object.entries(req.files || {})) {
      const f = arr?.[0];
      if (!f) continue;
      const itemKey = field === 'logo' ? 'logo' : DOK_LABELS[field] ? `dok:${field}` : null;
      if (!itemKey || !boleh.has(itemKey)) { fs.rm(f.path, { force: true }, () => {}); continue; }
      if (field === 'logo') {
        hapusPending(logoKey); logoKey = f.filename; logoNama = deps.cleanName(f.originalname);
      } else {
        const lama = db.prepare('select * from pendaftaran_dokumen where pendaftaran_id=? and jenis=?').get(p.id, field);
        if (lama) hapusPending(lama.storage_key);
        if (lama) db.prepare('update pendaftaran_dokumen set nama_file=?,storage_key=?,ukuran=? where id=?').run(deps.cleanName(f.originalname), f.filename, f.size, lama.id);
        else db.prepare('insert into pendaftaran_dokumen(pendaftaran_id,jenis,nama_file,storage_key,ukuran) values(?,?,?,?,?)').run(p.id, field, deps.cleanName(f.originalname), f.filename, f.size);
      }
      diubah.add(itemKey);
    }
    if (!diubah.size) { bersihkanUpload(req); return res.status(400).json({ error: 'Isi minimal satu item yang diminta revisi.' }); }
    db.transaction(() => {
      const upd = db.prepare("update pendaftaran_item set status='pending',catatan=null,updated_at=? where pendaftaran_id=? and item_key=?");
      for (const k of diubah) upd.run(now(), p.id, k);
      db.prepare("update pendaftaran_ormas set data=?,logo_key=?,logo_nama=?,status='tindaklanjuti',catatan=null,updated_at=? where id=?")
        .run(JSON.stringify(data), logoKey, logoNama, now(), p.id);
      catatRiwayat(p.id, 'tindaklanjuti', 'Revisi dikirim ke admin', null, 'ormas');
    })();
    notify({ jenis: 'admin', judul: `Revisi pendaftaran ormas: ${p.nama_ormas}`, pesan: 'Ormas mengirim revisi. CEK SELENGKAPNYA!' });
    if (deps.liveBroadcast) deps.liveBroadcast();
    notifPendaftar({ ...p, data }, 'Revisi pendaftaran diterima', 'Revisi Anda sudah dikirim ke admin dan sedang diperiksa ulang.');
    res.json({ ok: true, status: 'tindaklanjuti' });
  });

  // ----- Sisi admin -----
  appGet('/api/admin/pendaftaran/:id', auth('view_ormas'), (req, res) => {
    const p = db.prepare('select * from pendaftaran_ormas where id=?').get(+req.params.id);
    if (!p) return res.status(404).json({ error: 'Pendaftaran tidak ditemukan' });
    res.json(detailPendaftaran(p));
  });

  appPost('/api/admin/pendaftaran/:id/kembalikan', auth('manage_ormas'), (req, res) => {
    const p = db.prepare("select * from pendaftaran_ormas where id=? and status in ('tindaklanjuti','dikembalikan','hangus')").get(+req.params.id);
    if (!p) return res.status(404).json({ error: 'Pendaftaran tidak ditemukan atau sudah diproses' });
    const catatan = String(req.body?.catatan || '').trim().slice(0, 900);
    const masuk = Array.isArray(req.body?.items) ? req.body.items : [];
    const valid = new Set(db.prepare('select item_key from pendaftaran_item where pendaftaran_id=?').all(p.id).map((x) => x.item_key));
    const t = now(), batas = new Date(Date.now() + HARI).toISOString();
    db.transaction(() => {
      for (const it of masuk) {
        if (!valid.has(it?.key)) continue;
        const st = ['terverifikasi', 'revisi', 'pending'].includes(it.status) ? it.status : 'pending';
        db.prepare('update pendaftaran_item set status=?,catatan=?,updated_at=? where pendaftaran_id=? and item_key=?')
          .run(st, st === 'revisi' ? String(it.catatan || '').trim().slice(0, 900) : null, t, p.id, it.key);
      }
      db.prepare("update pendaftaran_ormas set status='dikembalikan',catatan=?,tanggal_dikembalikan=?,batas_revisi=?,izin_khusus=0,pengingat_3hari=0,revisi_count=coalesce(revisi_count,0)+1,updated_at=? where id=?")
        .run(catatan || null, t, batas, t, p.id);
      catatRiwayat(p.id, 'dikembalikan', 'Dikembalikan untuk revisi', catatan || null, 'admin');
    })();
    const nu = db.prepare('select * from pendaftaran_ormas where id=?').get(p.id);
    notifPendaftar(nu, 'Pendaftaran dikembalikan untuk revisi', catatan || 'Admin meminta perbaikan pada beberapa item. Silakan buka halaman Tracking Pendaftaran.');
    notify({ jenis: 'admin', judul: `Pendaftaran dikembalikan: ${p.nama_ormas}`, pesan: `Batas revisi ${new Date(batas).toLocaleString('id-ID')}.` });
    deps.log?.(req, 'kembalikan_pendaftaran', null, `Mengembalikan pendaftaran ${p.nama_ormas} untuk revisi`);
    res.json({ ok: true, batas_revisi: batas });
  });

  appPost('/api/admin/pendaftaran/:id/izin-khusus', auth('manage_ormas'), (req, res) => {
    const p = db.prepare("select * from pendaftaran_ormas where id=? and status in ('hangus','dikembalikan')").get(+req.params.id);
    if (!p) return res.status(404).json({ error: 'Pendaftaran tidak ditemukan atau tidak memerlukan izin khusus' });
    const t = now(), batas = new Date(Date.now() + HARI).toISOString();
    db.transaction(() => {
      db.prepare("update pendaftaran_ormas set status='dikembalikan',tanggal_dikembalikan=?,batas_revisi=?,izin_khusus=1,pengingat_3hari=0,updated_at=? where id=?").run(t, batas, t, p.id);
      catatRiwayat(p.id, 'dikembalikan', 'Izin khusus pengajuan ulang diberikan admin', String(req.body?.catatan || '').slice(0, 900) || null, 'admin');
    })();
    notifPendaftar({ ...p, tracking_id: p.tracking_id }, 'Izin khusus pengajuan ulang', 'Admin membuka kembali masa revisi Anda selama 30 hari.');
    deps.log?.(req, 'izin_khusus_pendaftaran', null, `Memberi izin khusus pengajuan ulang ${p.nama_ormas}`);
    res.json({ ok: true, batas_revisi: batas });
  });

  appPost('/api/admin/pendaftaran/:id/otp', auth('manage_ormas'), async (req, res) => {
    const p = db.prepare('select * from pendaftaran_ormas where id=?').get(+req.params.id);
    if (!p) return res.status(404).json({ error: 'Pendaftaran tidak ditemukan' });
    const kanal = req.body?.channel === 'wa' ? 'wa' : 'email';
    const ok = await (kanal === 'wa' ? kirimOtpWa(p, true) : kirimOtpEmail(p, true));
    if (!ok) return res.status(400).json({ error: kanal === 'wa' ? 'Nomor WhatsApp tidak valid atau WA_TOKEN belum diisi.' : 'Email pendaftar belum diisi atau pengiriman email belum dikonfigurasi.' });
    deps.log?.(req, 'kirim_otp_tracking', null, `Mengirim ulang OTP tracking ${p.nama_ormas} lewat ${kanal}`);
    res.json({ ok: true, channel: kanal, message: kanal === 'wa' ? 'OTP sudah dikirim ke WhatsApp pendaftar.' : 'OTP sudah dikirim ke email pendaftar.' });
  });
}

// Ringkasan helper agar index.js tidak perlu mengulang query mapping.
function appGet(...a) { D.app.get(...a); }
function appPost(...a) { D.app.post(...a); }
function appPut(...a) { D.app.put(...a); }

// Dijalankan saat server start dan tiap jam: tutup revisi yang lewat batas + kirim pengingat 3 hari.
export function cekTracking() {
  const t = now(), t3 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  for (const p of db.prepare("select * from pendaftaran_ormas where status='dikembalikan' and batas_revisi is not null and batas_revisi<=?").all(t)) {
    db.transaction(() => {
      db.prepare("update pendaftaran_ormas set status='hangus',updated_at=? where id=?").run(t, p.id);
      catatRiwayat(p.id, 'hangus', 'Batas revisi berakhir — pengajuan hangus', null, 'sistem');
      notify({ jenis: 'admin', judul: `Revisi hangus: ${p.nama_ormas}`, pesan: 'Batas 30 hari berakhir. Admin masih dapat memberi izin khusus.', kunci: `hangus:${p.id}`, push: false });
    })();
    notifPendaftar(p, 'Batas revisi pendaftaran berakhir', 'Masa revisi 30 hari sudah habis. Hubungi admin bila ingin pengajuan ulang.');
  }
  for (const p of db.prepare("select * from pendaftaran_ormas where status='dikembalikan' and batas_revisi>? and batas_revisi<=?").all(t, t3)) {
    notify({ jenis: 'admin', judul: `Revisi akan berakhir: ${p.nama_ormas}`, pesan: `Batas revisi ${new Date(p.batas_revisi).toLocaleString('id-ID')}.`, kunci: `revisi:3hari:${p.id}`, push: false });
    if (!p.pengingat_3hari) {
      notifPendaftar(p, 'Pengingat batas revisi', `Masa revisi tinggal ${countdown(p.batas_revisi).teks}. Segera perbaiki pendaftaran Anda.`);
      db.prepare('update pendaftaran_ormas set pengingat_3hari=1 where id=?').run(p.id);
    }
  }
  const batas = Date.now() - 60 * 60 * 1000;
  for (const [k, v] of attempts) if (!v.until || v.until < batas) attempts.delete(k);
}
