// Revisi Batch 4-7 (tahap 2): Legal Standing, kontak, dashboard ormas, laporan kegiatan tahunan.
// Skema database ada di db.js (tahap 1). Semua aturan akses diperiksa di server:
// sesi ormas hanya bisa melihat dan mengubah datanya sendiri (id ormas diambil dari sesi, bukan dari permintaan).
import { db } from './db.js';
import { parseBerlaku, tglIndo, SEGERA, notify } from './fitur.js';

const now = () => new Date().toISOString();
const todayJkt = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
const tahunIni = () => +todayJkt().slice(0, 4);
const bulanIni = () => +todayJkt().slice(5, 7);
const urlOk = (v) => { try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } };
const PHONE_RE = /^\+?[0-9][0-9\s-]{7,19}$/;
const KATEGORI_NOTIF = ['Information', 'Warning', 'Required Action'];
const URUT = { 'Required Action': 0, Warning: 1, Information: 2 };
const LEGAL_FIELDS = ['legal_jenis', 'nomor_sk', 'legal_tahun', 'legal_berlaku_sd'];

// Masking nomor telepon ketua untuk katalog publik, dilakukan di server (bukan hanya tampilan).
// Contoh: 081234567823 -> 08********23
export const maskPhone = (raw) => {
  const s = String(raw || '').replace(/[\s-]/g, '');
  if (!s) return '';
  const keep = s.startsWith('+') ? 3 : 2;
  if (s.length <= keep + 2) return '*'.repeat(s.length);
  return s.slice(0, keep) + '*'.repeat(s.length - keep - 2) + s.slice(-2);
};

// Validasi Legal Standing dan nomor telepon ormas (dipakai formulir pendaftaran, portal ormas, dan admin)
export function cekLegalKontak(b) {
  const ls = b.legal_status;
  if (ls !== undefined && !['', 'ya', 'tidak'].includes(String(ls))) return 'Status Legal Standing harus Ya atau Tidak';
  const tel = String(b.telepon_ormas ?? '').trim();
  if (tel && !PHONE_RE.test(tel)) return 'Nomor telepon ormas tidak valid (contoh: 0274123456 atau 081234567890)';
  if (ls === 'ya' && (!String(b.legal_jenis ?? '').trim() || !String(b.nomor_sk ?? '').trim())) return 'Jika sudah memiliki Legal Standing, isi Jenis dan Nomor Legal Standing';
  return null;
}

const hariKe = (tgl) => {
  const [y, m, d] = tgl.split('-').map(Number), [ty, tm, td] = todayJkt().split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
};
// Status masa berlaku satu dokumen: Aktif | Akan Berakhir (31-90 hari) | Segera Diperbarui (0-30 hari) | Kedaluwarsa | Belum Memiliki Data
export function statusMasa(berlakuSd) {
  const p = parseBerlaku(berlakuSd);
  if (p.tgl) { const h = hariKe(p.tgl); return { berakhir: p.tgl, hari: h, status: h < 0 ? 'Kedaluwarsa' : h <= 30 ? 'Segera Diperbarui' : h <= SEGERA ? 'Akan Berakhir' : 'Aktif' }; }
  if (p.seumurHidup) return { berakhir: null, seumur_hidup: true, status: 'Aktif' };
  return { berakhir: null, status: 'Belum Memiliki Data', tidak_terbaca: !!p.tidakTerbaca };
}

const ringkasanLegal = () => {
  const r = db.prepare(`select coalesce(legal_status,'') s,count(*) c from ormas group by s`).all();
  const g = (s) => r.find((x) => x.s === s)?.c || 0;
  return { ya: g('ya'), tidak: g('tidak'), belum_diisi: g(''), total: r.reduce((a, x) => a + x.c, 0) };
};

// ---------- Dashboard ormas ----------
// Data "efektif": perubahan yang menunggu verifikasi ikut dihitung agar ormas melihat hasil isiannya sendiri.
function efektif(id) {
  const o = db.prepare('select * from ormas where id=?').get(id);
  const pr = db.prepare('select * from perubahan_ormas where ormas_id=?').get(id);
  let pd = {}; try { pd = pr ? JSON.parse(pr.data) : {}; } catch {}
  return { o: { ...o, ...pd }, pending: !!pr, logo: pr?.logo_key ? true : pr?.remove_logo ? false : !!o.logo_key };
}
function dokMap(id) {
  const m = {};
  for (const r of db.prepare('select jenis_dokumen j,nama_file,uploaded_at,pending from dokumen_ormas where ormas_id=? and jenis_dokumen is not null order by pending,id').all(id)) m[r.j] = r; // yang pending menggantikan yang resmi
  return m;
}
const WAJIB = [['bentuk', 'Bentuk ormas', 'identitas'], ['bidang_kegiatan', 'Bidang kegiatan', 'identitas'], ['kemantren', 'Kemantren', 'identitas'], ['nama_ketua', 'Nama ketua', 'pengurus'], ['sekretaris', 'Sekretaris', 'pengurus'], ['bendahara', 'Bendahara', 'pengurus'], ['nomor_whatsapp_ketua', 'Nomor telepon ketua', 'kontak'], ['telepon_ormas', 'Nomor telepon ormas', 'kontak'], ['email_ormas', 'Email ormas', 'kontak'], ['alamat', 'Alamat kantor', 'kontak'], ['anggota_total', 'Jumlah anggota', 'anggota']];
const DOK5 = [['sk_pengurusan', 'SK Pengurusan'], ['surat_domisili', 'Surat Keterangan Domisili'], ['program_kerja', 'Program Kerja'], ['badan_hukum', 'Salinan Badan Hukum'], ['skto', 'SKTO']];
const DOK_LAIN = [['adart', 'AD/ART'], ['company_profile', 'Company Profile']];
const CP_BAGIAN = ['deskripsi', 'visi', 'misi', 'legal', 'bidang', 'dana', 'anggota', 'pengurus', 'program'];
const fmtTgl = (t) => (t ? tglIndo(t) : '-');

function monitoringDokumen(o, dm) {
  const out = [];
  const bertanggal = (kunci, nama, tahun, sd, link, kosongCatatan) => {
    const e = statusMasa(sd);
    out.push({ kunci, nama, berlaku: tahun ? `Tahun ${tahun}` : '-', berakhir: e.seumur_hidup ? 'Seumur hidup' : fmtTgl(e.berakhir), hari: e.hari ?? null, status: e.status, catatan: e.status === 'Belum Memiliki Data' ? kosongCatatan : '', link });
  };
  if (o.legal_status === 'tidak') out.push({ kunci: 'legal_standing', nama: 'Legal Standing', berlaku: '-', berakhir: '-', hari: null, status: 'Belum Memiliki Data', catatan: 'Ormas belum memiliki Legal Standing', link: '/portal/data#legal' });
  else bertanggal('legal_standing', 'Legal Standing', o.legal_tahun, o.legal_berlaku_sd, '/portal/data#legal', 'Tanggal berlaku belum diisi');
  bertanggal('skto', 'SKTO', o.skto_tahun, o.skto_berlaku_sd, '/portal/data#skto', 'Tanggal berlaku belum diisi');
  for (const [k, nama] of [...DOK5.filter(([k]) => k !== 'skto'), ...DOK_LAIN]) {
    const d = dm[k];
    out.push({ kunci: k, nama, berlaku: d ? `Diunggah ${fmtTgl(String(d.uploaded_at).slice(0, 10))}` : '-', berakhir: '-', hari: null, status: d ? 'Aktif' : 'Belum Memiliki Data', catatan: d?.pending ? 'Menunggu verifikasi admin' : d ? '' : 'Belum diunggah', link: '/portal/data#f_' + k });
  }
  return out;
}

function dashboard(id) {
  const { o, pending, logo } = efektif(id), dm = dokMap(id);
  const kat = db.prepare('select nama_kategori from kategori where id=?').get(o.kategori_id)?.nama_kategori;
  const dok = monitoringDokumen(o, dm);

  // Profil: kelengkapan data wajib
  const kurang = WAJIB.filter(([k]) => !String(o[k] ?? '').trim()).map(([, l, a]) => ({ label: l, link: '/portal/data#' + a }));
  if (!logo) kurang.push({ label: 'Logo ormas', link: '/portal/data#identitas' });
  if (!o.legal_status) kurang.push({ label: 'Status Legal Standing', link: '/portal/data#legal' });
  else if (o.legal_status === 'ya' && (!String(o.legal_jenis || '').trim() || !String(o.nomor_sk || '').trim())) kurang.push({ label: 'Data Legal Standing', link: '/portal/data#legal' });
  DOK5.filter(([k]) => !dm[k]).forEach(([k, l]) => kurang.push({ label: `Dokumen ${l}`, link: '/portal/data#f_' + k }));
  const total = WAJIB.length + 1 + 1 + DOK5.length;
  const persen = Math.max(0, Math.round(((total - kurang.length) / total) * 100));

  // Company Profile
  const cpBag = String(o.cp_bagian || '').split(',').filter((x) => CP_BAGIAN.includes(x));
  const cpAda = !!dm.company_profile;
  const company_profile = { ada: cpAda, bagian_terisi: cpBag.length, bagian_total: CP_BAGIAN.length, status: !cpAda ? 'Belum Ada File' : cpBag.length >= CP_BAGIAN.length ? 'Lengkap' : 'Belum Lengkap' };

  // Laporan tahunan
  const th = tahunIni();
  const lap = db.prepare('select tahun,status,catatan_admin,updated_at from laporan_tahunan where ormas_id=? order by tahun desc').all(id);
  const cur = lap.find((l) => l.tahun === th);
  const laporan = { tahun: th, status: cur?.status || 'belum', catatan_admin: cur?.catatan_admin || '', arsip: lap.filter((l) => ['dikirim', 'diterima'].includes(l.status)).length };
  const laporanSelesai = ['dikirim', 'diterima'].includes(laporan.status);

  // Data yang perlu diperbarui: kekurangan data + dokumen yang perlu perhatian + laporan
  const perlu = [...kurang];
  dok.filter((d) => ['Akan Berakhir', 'Segera Diperbarui', 'Kedaluwarsa'].includes(d.status)).forEach((d) => perlu.push({ label: `${d.nama}: ${d.status}`, link: d.link }));
  if (!laporanSelesai) perlu.push({ label: `Laporan Kegiatan Tahunan ${th}`, link: `/portal/laporan/${th}` });

  // Notifikasi otomatis (dihitung saat dashboard dibuka) + notifikasi dari admin + pengumuman
  const auto = [];
  const add = (kategori, jenis, judul, pesan, link) => auto.push({ id: null, auto: true, kategori, jenis, judul, pesan, link, dibaca: false });
  for (const d of dok) {
    if (d.status === 'Kedaluwarsa') add('Required Action', 'dokumen', `${d.nama} sudah kedaluwarsa`, `${d.nama} berakhir pada ${d.berakhir}. Segera perbarui dokumen ini.`, d.link);
    else if (d.status === 'Segera Diperbarui') add('Required Action', 'dokumen', `${d.nama} segera berakhir`, `${d.nama} berakhir pada ${d.berakhir} (${d.hari} hari lagi). Segera perbarui.`, d.link);
    else if (d.status === 'Akan Berakhir') add('Warning', 'dokumen', `${d.nama} akan berakhir`, `${d.nama} berakhir pada ${d.berakhir} (${d.hari} hari lagi). Siapkan pembaruan.`, d.link);
  }
  if (!o.legal_status) add('Required Action', 'legal', 'Status Legal Standing belum diisi', 'Jawab pertanyaan "Apakah sudah memiliki Legal Standing?" pada menu Legal Standing.', '/portal/data#legal');
  else if (o.legal_status === 'tidak') add('Information', 'legal', 'Ormas belum memiliki Legal Standing', 'Anda tidak perlu mengisi data dokumen Legal Standing. Ubah statusnya jika nanti sudah memilikinya.', '/portal/data#legal');
  if (laporan.status === 'revisi') add('Required Action', 'laporan', `Laporan ${th} perlu direvisi`, laporan.catatan_admin || 'Admin meminta revisi laporan. Perbaiki lalu kirim ulang.', `/portal/laporan/${th}`);
  else if (!laporanSelesai) {
    const bln = bulanIni();
    add(bln >= 11 ? 'Required Action' : bln >= 9 ? 'Warning' : 'Information', 'laporan', `Laporan Kegiatan Tahunan ${th} belum dikirim`, 'Setiap ormas wajib membuat Laporan Kegiatan Tahunan.', `/portal/laporan/${th}`);
  }
  const prev = lap.find((l) => l.tahun === th - 1);
  if (bulanIni() <= 3 && !['dikirim', 'diterima'].includes(prev?.status || '') && lap.length) add('Warning', 'laporan', `Laporan tahun ${th - 1} belum dikirim`, 'Lengkapi dan kirim laporan tahun sebelumnya.', `/portal/laporan/${th - 1}`);
  if (pending) add('Information', 'verifikasi', 'Perubahan menunggu verifikasi', 'Katalog publik masih memakai data lama sampai admin memverifikasi perubahan Anda.', '/portal/data');
  else if (o.catatan_penolakan) add('Required Action', 'verifikasi', 'Perubahan ditolak admin', o.catatan_penolakan, '/portal/data');
  if (persen < 100) add('Information', 'profil', 'Data ormas belum lengkap', `${kurang.length} isian atau dokumen masih perlu dilengkapi.`, '/portal/data');

  const LINK = { revisi: '/portal/laporan', catatan_admin: null };
  const stored = db.prepare('select id,kategori,jenis,judul,pesan,dibaca,created_at from notifikasi_ormas where ormas_id=? order by id desc limit 50').all(id).map((n) => ({ ...n, dibaca: !!n.dibaca, auto: false, link: LINK[n.jenis] ?? null }));
  const pengumuman = db.prepare('select id,kategori,judul,pesan,created_at from pengumuman where aktif=1 order by id desc limit 10').all().map((p) => ({ ...p, id: null, auto: true, jenis: 'pengumuman', dibaca: true, link: null }));
  const notifikasi = [...auto, ...stored, ...pengumuman].sort((a, b) => (URUT[a.kategori] ?? 2) - (URUT[b.kategori] ?? 2));

  const catatan = [];
  if (o.catatan_verifikasi) catatan.push({ sumber: 'Catatan verifikasi', pesan: o.catatan_verifikasi });
  if (!pending && o.catatan_penolakan) catatan.push({ sumber: 'Perubahan ditolak', pesan: o.catatan_penolakan });
  stored.filter((n) => n.jenis === 'catatan_admin').slice(0, 5).forEach((n) => catatan.push({ sumber: n.judul, pesan: n.pesan, tanggal: n.created_at }));

  return {
    ormas: { kode_ormas: o.kode_ormas, nama_ormas: o.nama_ormas, nama_kategori: kat, status_dokumen: o.status_dokumen, status_operasional: o.status_operasional, status_publikasi: o.status_publikasi, pending, has_logo: logo, updated_at: o.updated_at },
    profil: { persen, kurang }, company_profile,
    legal: { status: o.legal_status || '', jenis: o.legal_jenis || '', nomor: o.nomor_sk || '', tahun: o.legal_tahun || '', berlaku_sd: o.legal_berlaku_sd || '' },
    dokumen: dok, laporan, perlu_diperbarui: perlu, catatan_admin: catatan, notifikasi, belum_dibaca: stored.filter((n) => !n.dibaca).length,
  };
}

// ---------- Laporan kegiatan tahunan ----------
const LAP_TEXT = { rencana_program: 8000, pelaksanaan_kegiatan: 8000, sumber_dana: 500, dokumentasi_link: 500, penutup: 4000 };
const LAP_LABEL = { rencana_program: 'Rencana Program Kegiatan', pelaksanaan_kegiatan: 'Pelaksanaan Kegiatan', sumber_dana: 'Sumber dana', dokumentasi_link: 'Link dokumentasi', penutup: 'Penutup' };
const tahunOk = (t) => Number.isInteger(+t) && +t >= 2000 && +t <= tahunIni();
const EDITABLE = ['belum', 'draft', 'revisi'];
function bacaLaporan(b) {
  const r = {};
  for (const [k, max] of Object.entries(LAP_TEXT)) { const v = String(b[k] ?? '').trim(); if (v.length > max) return { err: `Isian "${LAP_LABEL[k]}" terlalu panjang (maks. ${max} karakter)` }; r[k] = v; }
  if (r.dokumentasi_link && !urlOk(r.dokumentasi_link)) return { err: 'Link dokumentasi harus diawali http:// atau https://' };
  const raw = String(b.biaya_kegiatan ?? '').replace(/rp/i, '').replace(/[.,\s]/g, '');
  if (raw && !/^\d{1,13}$/.test(raw)) return { err: 'Besaran biaya harus berupa angka (rupiah)' };
  r.biaya_kegiatan = raw === '' ? null : +raw;
  return { r };
}
const lapOut = (r, th) => ({
  tahun: th, status: r?.status || 'belum', rencana_program: r?.rencana_program || '', pelaksanaan_kegiatan: r?.pelaksanaan_kegiatan || '', biaya_kegiatan: r?.biaya_kegiatan ?? null,
  sumber_dana: r?.sumber_dana || '', dokumentasi_link: r?.dokumentasi_link || '', penutup: r?.penutup || '', catatan_admin: r?.catatan_admin || '', dikirim_at: r?.dikirim_at || null, updated_at: r?.updated_at || null,
  editable: EDITABLE.includes(r?.status || 'belum'),
});
const kirimNotifOrmas = (ormasId, kategori, jenis, judul, pesan) => db.prepare('insert into notifikasi_ormas(ormas_id,kategori,jenis,judul,pesan,created_at) values(?,?,?,?,?,?)').run(ormasId, kategori, jenis, judul, pesan, now());

export function setupBatch47({ app, auth, portalAuth, portalWho, log, notifAdmin }) {
  // ===== Portal ormas: dashboard dan notifikasi =====
  app.get('/api/portal/dashboard', portalAuth(), (req, res) => { res.set('Cache-Control', 'no-store'); res.json(dashboard(req.portal.ormas.id)); });
  app.post('/api/portal/notifikasi/read-all', portalAuth(), (req, res) => { db.prepare('update notifikasi_ormas set dibaca=1 where ormas_id=?').run(req.portal.ormas.id); res.json({ ok: true }); });
  app.post('/api/portal/notifikasi/:id/read', portalAuth(), (req, res) => { db.prepare('update notifikasi_ormas set dibaca=1 where id=? and ormas_id=?').run(+req.params.id, req.portal.ormas.id); res.json({ ok: true }); });

  // ===== Portal ormas: laporan kegiatan tahunan (hanya milik ormas itu sendiri) =====
  app.get('/api/portal/laporan', portalAuth(), (req, res) => {
    const oid = req.portal.ormas.id, th = tahunIni();
    const items = db.prepare('select tahun,status,updated_at,dikirim_at,catatan_admin from laporan_tahunan where ormas_id=? order by tahun desc').all(oid);
    if (!items.some((i) => i.tahun === th)) items.unshift({ tahun: th, status: 'belum', updated_at: null, dikirim_at: null, catatan_admin: null });
    res.json({ tahun_ini: th, items });
  });
  app.get('/api/portal/laporan/:tahun', portalAuth(), (req, res) => {
    const th = +req.params.tahun; if (!tahunOk(th)) return res.status(400).json({ error: 'Tahun laporan tidak valid' });
    res.json(lapOut(db.prepare('select * from laporan_tahunan where ormas_id=? and tahun=?').get(req.portal.ormas.id, th), th));
  });
  app.put('/api/portal/laporan/:tahun', portalAuth(), (req, res) => {
    const th = +req.params.tahun; if (!tahunOk(th)) return res.status(400).json({ error: 'Tahun laporan tidak valid' });
    const o = req.portal.ormas, ex = db.prepare('select * from laporan_tahunan where ormas_id=? and tahun=?').get(o.id, th);
    if (ex && !EDITABLE.includes(ex.status)) return res.status(409).json({ error: 'Laporan yang sudah dikirim tidak dapat diubah. Hubungi admin jika perlu direvisi.' });
    const { r, err } = bacaLaporan(req.body || {}); if (err) return res.status(400).json({ error: err });
    const kirim = req.body?.kirim === true;
    if (kirim) {
      const kurang = [['rencana_program', 'Rencana Program Kegiatan'], ['pelaksanaan_kegiatan', 'Pelaksanaan Kegiatan'], ['biaya_kegiatan', 'Besaran biaya'], ['sumber_dana', 'Sumber dana'], ['penutup', 'Penutup']].filter(([k]) => r[k] === '' || r[k] == null).map(([, l]) => l);
      if (kurang.length) return res.status(400).json({ error: `Lengkapi dulu sebelum mengirim: ${kurang.join(', ')}` });
    }
    const t = now(), status = kirim ? 'dikirim' : ex?.status === 'revisi' ? 'revisi' : 'draft';
    db.prepare(`insert into laporan_tahunan(ormas_id,tahun,rencana_program,pelaksanaan_kegiatan,biaya_kegiatan,sumber_dana,dokumentasi_link,penutup,status,dikirim_at,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,?,?)
      on conflict(ormas_id,tahun) do update set rencana_program=excluded.rencana_program,pelaksanaan_kegiatan=excluded.pelaksanaan_kegiatan,biaya_kegiatan=excluded.biaya_kegiatan,sumber_dana=excluded.sumber_dana,dokumentasi_link=excluded.dokumentasi_link,penutup=excluded.penutup,status=excluded.status,dikirim_at=coalesce(excluded.dikirim_at,laporan_tahunan.dikirim_at),updated_at=excluded.updated_at`)
      .run(o.id, th, r.rencana_program, r.pelaksanaan_kegiatan, r.biaya_kegiatan, r.sumber_dana, r.dokumentasi_link, r.penutup, status, kirim ? t : null, t, t);
    if (kirim) {
      log(req, 'kirim_laporan_tahunan', o.id, `Ormas mengirim Laporan Kegiatan Tahunan ${th}`, 'berhasil', portalWho(req.portal));
      notify({ jenis: 'ormas', judul: `${o.kode_ormas} mengirim laporan tahunan ${th}`, pesan: `Ormas (${o.nama_ormas}) Telah Mengirim Laporan Kegiatan Tahunan ${th}, CEK SELENGKAPNYA!`, ormasId: o.id });
    }
    res.json({ ok: true, status });
  });

  // ===== Admin: monitoring Legal Standing =====
  app.get('/api/admin/legal/ringkasan', auth('view_ormas'), (req, res) => res.json(ringkasanLegal()));
  app.get('/api/admin/legal', auth('view_ormas'), (req, res) => {
    const st = String(req.query.status || ''), q = String(req.query.q || '').trim(), w = [], p = [];
    if (st === 'ya' || st === 'tidak') { w.push('o.legal_status=?'); p.push(st); } else if (st === 'belum') w.push(`coalesce(o.legal_status,'')=''`);
    if (q) { w.push('(o.nama_ormas like ? or o.kode_ormas like ?)'); p.push(`%${q}%`, `%${q}%`); }
    const where = w.length ? 'where ' + w.join(' and ') : '';
    const page = Math.max(1, +req.query.page || 1), size = 15;
    const total = db.prepare(`select count(*) c from ormas o ${where}`).get(...p).c;
    const items = db.prepare(`select o.id,o.kode_ormas,o.nama_ormas,k.nama_kategori,o.legal_status,o.legal_jenis,o.nomor_sk,o.legal_tahun,o.legal_berlaku_sd,o.nama_ketua,o.nomor_whatsapp_ketua,o.telepon_ormas,(select count(*) from perubahan_ormas pp where pp.ormas_id=o.id) as has_pending from ormas o join kategori k on k.id=o.kategori_id ${where} order by o.id limit ? offset ?`).all(...p, size, (page - 1) * size);
    // Admin melihat nomor telepon ketua dan ormas secara lengkap (tanpa masking)
    res.json({ ...ringkasanLegal(), items: items.map((i) => ({ ...i, exp: i.legal_status === 'ya' ? statusMasa(i.legal_berlaku_sd) : null })), total, page, pageSize: size });
  });
  app.put('/api/admin/ormas/:id/legal-kontak', auth('manage_ormas'), (req, res) => {
    const id = +req.params.id, b = req.body || {}, o = db.prepare('select * from ormas where id=?').get(id);
    if (!o) return res.status(404).json({ error: 'Data tidak ditemukan' });
    if (db.prepare('select 1 from perubahan_ormas where ormas_id=?').get(id)) return res.status(409).json({ error: 'Ormas ini punya perubahan yang menunggu verifikasi. Verifikasi atau tolak dulu sebelum mengedit.' });
    const ketua = String(b.nomor_whatsapp_ketua ?? o.nomor_whatsapp_ketua ?? '').trim();
    if (ketua && !PHONE_RE.test(ketua)) return res.status(400).json({ error: 'Nomor telepon ketua tidak valid (contoh: 081234567890)' });
    const err = cekLegalKontak(b); if (err) return res.status(400).json({ error: err });
    const ls = String(b.legal_status ?? o.legal_status ?? ''), v = {};
    for (const k of LEGAL_FIELDS) v[k] = ls === 'tidak' ? '' : String(b[k] ?? o[k] ?? '').trim();
    for (const [k, max] of [['legal_jenis', 100], ['nomor_sk', 100], ['legal_berlaku_sd', 50]]) if (v[k].length > max) return res.status(400).json({ error: 'Isian Legal Standing terlalu panjang' });
    if (v.legal_tahun && !/^(19|20)\d{2}$/.test(v.legal_tahun)) return res.status(400).json({ error: 'Tahun harus 4 digit (contoh: 2021)' });
    const tel = String(b.telepon_ormas ?? o.telepon_ormas ?? '').trim();
    db.prepare('update ormas set legal_status=?,legal_jenis=?,nomor_sk=?,legal_tahun=?,legal_berlaku_sd=?,telepon_ormas=?,nomor_whatsapp_ketua=?,updated_at=?,updated_by=? where id=?')
      .run(ls, v.legal_jenis, v.nomor_sk, v.legal_tahun, v.legal_berlaku_sd, tel, ketua, now(), req.admin.id, id);
    log(req, 'ubah_legal_kontak', id, `Mengubah Legal Standing dan kontak ${o.kode_ormas} (status: ${ls || 'belum diisi'})`);
    notifAdmin(req, `Mengubah Legal Standing dan kontak ${o.kode_ormas} (${o.nama_ormas})`, id);
    res.json({ ok: true });
  });

  // ===== Admin: laporan tahunan seluruh ormas =====
  app.get('/api/admin/laporan', auth('view_ormas'), (req, res) => {
    const th = tahunOk(req.query.tahun) ? +req.query.tahun : tahunIni(), st = String(req.query.status || ''), q = String(req.query.q || '').trim();
    const counts = Object.fromEntries(db.prepare(`select coalesce(l.status,'belum') s,count(*) c from ormas o left join laporan_tahunan l on l.ormas_id=o.id and l.tahun=? group by s`).all(th).map((r) => [r.s, r.c]));
    const w = [], p = [th];
    if (st === 'belum') w.push('l.id is null'); else if (['draft', 'dikirim', 'revisi', 'diterima'].includes(st)) { w.push('l.status=?'); p.push(st); }
    if (q) { w.push('(o.nama_ormas like ? or o.kode_ormas like ?)'); p.push(`%${q}%`, `%${q}%`); }
    const from = `from ormas o join kategori k on k.id=o.kategori_id left join laporan_tahunan l on l.ormas_id=o.id and l.tahun=? ${w.length ? 'where ' + w.join(' and ') : ''}`;
    const page = Math.max(1, +req.query.page || 1), size = 15;
    const total = db.prepare(`select count(*) c ${from}`).get(...p).c;
    const items = db.prepare(`select o.id,o.kode_ormas,o.nama_ormas,k.nama_kategori,coalesce(l.status,'belum') status,l.dikirim_at,l.updated_at,l.catatan_admin ${from} order by o.id limit ? offset ?`).all(...p, size, (page - 1) * size);
    const tahun = db.prepare('select distinct tahun from laporan_tahunan').all().map((r) => r.tahun);
    if (!tahun.includes(tahunIni())) tahun.push(tahunIni());
    res.json({ tahun: th, daftar_tahun: tahun.sort((a, b) => b - a), counts, total_ormas: Object.values(counts).reduce((a, c) => a + c, 0), items, total, page, pageSize: size });
  });
  app.get('/api/admin/laporan/:ormasId/:tahun', auth('view_ormas'), (req, res) => {
    const id = +req.params.ormasId, th = +req.params.tahun;
    const o = db.prepare('select id,kode_ormas,nama_ormas from ormas where id=?').get(id);
    if (!o || !tahunOk(th)) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    res.json({ ormas: o, ...lapOut(db.prepare('select * from laporan_tahunan where ormas_id=? and tahun=?').get(id, th), th), arsip: db.prepare('select tahun,status,dikirim_at from laporan_tahunan where ormas_id=? order by tahun desc').all(id) });
  });
  const tinjau = (status) => (req, res) => {
    const id = +req.params.ormasId, th = +req.params.tahun, o = db.prepare('select id,kode_ormas,nama_ormas from ormas where id=?').get(id);
    const l = db.prepare('select * from laporan_tahunan where ormas_id=? and tahun=?').get(id, th);
    if (!o || !l) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    if (l.status !== 'dikirim') return res.status(409).json({ error: 'Hanya laporan yang berstatus Dikirim yang dapat diperiksa' });
    const catatan = String(req.body?.catatan || '').trim().slice(0, 900);
    if (status === 'revisi' && !catatan) return res.status(400).json({ error: 'Tulis catatan revisi untuk ormas' });
    db.prepare('update laporan_tahunan set status=?,catatan_admin=?,updated_at=? where id=?').run(status, catatan || null, now(), l.id);
    if (status === 'revisi') kirimNotifOrmas(id, 'Required Action', 'revisi', `Permintaan revisi Laporan Kegiatan Tahunan ${th}`, catatan);
    else kirimNotifOrmas(id, 'Information', 'catatan_admin', `Laporan Kegiatan Tahunan ${th} diterima`, catatan || 'Laporan Anda sudah diperiksa dan diterima admin.');
    log(req, status === 'revisi' ? 'revisi_laporan_tahunan' : 'terima_laporan_tahunan', id, `${status === 'revisi' ? 'Meminta revisi' : 'Menerima'} laporan ${th} dari ${o.kode_ormas}`);
    notifAdmin(req, `${status === 'revisi' ? 'Meminta revisi' : 'Menerima'} laporan tahunan ${th} dari ${o.kode_ormas} (${o.nama_ormas})`, id);
    res.json({ ok: true });
  };
  app.post('/api/admin/laporan/:ormasId/:tahun/revisi', auth('manage_ormas'), tinjau('revisi'));
  app.post('/api/admin/laporan/:ormasId/:tahun/terima', auth('manage_ormas'), tinjau('diterima'));

  // ===== Admin: catatan untuk ormas dan pengumuman SIDOMAS =====
  app.post('/api/admin/ormas/:id/notifikasi', auth('manage_ormas'), (req, res) => {
    const id = +req.params.id, b = req.body || {}, o = db.prepare('select id,kode_ormas,nama_ormas from ormas where id=?').get(id);
    if (!o) return res.status(404).json({ error: 'Data tidak ditemukan' });
    const judul = String(b.judul || '').trim(), pesan = String(b.pesan || '').trim();
    if (!KATEGORI_NOTIF.includes(b.kategori)) return res.status(400).json({ error: 'Kategori notifikasi tidak valid' });
    if (!['catatan_admin', 'revisi'].includes(b.jenis)) return res.status(400).json({ error: 'Jenis notifikasi tidak valid' });
    if (!judul || judul.length > 120 || !pesan || pesan.length > 1000) return res.status(400).json({ error: 'Judul (maks. 120) dan pesan (maks. 1000 karakter) wajib diisi' });
    kirimNotifOrmas(id, b.kategori, b.jenis, judul, pesan);
    log(req, 'kirim_notifikasi_ormas', id, `Mengirim ${b.jenis === 'revisi' ? 'permintaan revisi' : 'catatan'} ke ${o.kode_ormas}: ${judul}`);
    res.json({ ok: true });
  });
  app.get('/api/admin/pengumuman', auth('view_ormas'), (req, res) => res.json({ items: db.prepare('select p.id,p.kategori,p.judul,p.pesan,p.aktif,p.created_at,a.username from pengumuman p left join admin a on a.id=p.created_by order by p.id desc limit 50').all() }));
  app.post('/api/admin/pengumuman', auth('manage_ormas'), (req, res) => {
    const b = req.body || {}, judul = String(b.judul || '').trim(), pesan = String(b.pesan || '').trim();
    if (!KATEGORI_NOTIF.includes(b.kategori)) return res.status(400).json({ error: 'Kategori pengumuman tidak valid' });
    if (!judul || judul.length > 120 || !pesan || pesan.length > 1000) return res.status(400).json({ error: 'Judul (maks. 120) dan pesan (maks. 1000 karakter) wajib diisi' });
    db.prepare('insert into pengumuman(kategori,judul,pesan,aktif,created_by,created_at) values(?,?,?,1,?,?)').run(b.kategori, judul, pesan, req.admin.id, now());
    log(req, 'tambah_pengumuman', null, `Membuat pengumuman SIDOMAS: ${judul}`);
    res.json({ ok: true });
  });
  app.put('/api/admin/pengumuman/:id', auth('manage_ormas'), (req, res) => {
    db.prepare('update pengumuman set aktif=? where id=?').run(req.body?.aktif ? 1 : 0, +req.params.id);
    res.json({ ok: true });
  });
  app.delete('/api/admin/pengumuman/:id', auth('manage_ormas'), (req, res) => {
    db.prepare('delete from pengumuman where id=?').run(+req.params.id);
    log(req, 'hapus_pengumuman', null, 'Menghapus pengumuman SIDOMAS');
    res.json({ ok: true });
  });
}
