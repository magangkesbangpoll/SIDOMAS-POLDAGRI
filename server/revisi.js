// Revisi Batch 4-7 SIDOMAS:
//  - Batch 4: monitoring Legal Standing oleh admin (statistik, daftar, filter)
//  - Batch 6: dashboard Ormas (status, monitoring masa berlaku dokumen, notifikasi) + pengumuman SIDOMAS + catatan admin
//  - Batch 7: Laporan Kegiatan Tahunan (per tahun, arsip, pemantauan admin)
// Semua rute portal mengambil id ormas dari sesi login (bukan dari permintaan), sehingga ormas hanya bisa mengelola datanya sendiri.
import { db } from './db.js';
import { expiryInfo, tglIndo, notify } from './fitur.js';

const now = () => new Date().toISOString();
const jkt = (opt) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', ...opt }).format(new Date());
const tahunIni = () => +jkt({ year: 'numeric' });
const bulanIni = () => +jkt({ month: 'numeric' });
const KATEGORI = ['Information', 'Warning', 'Required Action'];
const URUT = { 'Required Action': 0, Warning: 1, Information: 2 };
const urlOk = (v) => { try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } };

// ---------- Batch 4: statistik Legal Standing ----------
// ya = memiliki; tidak = menyatakan belum memiliki; belum_diisi = belum pernah ditentukan
export function legalStats() {
  const c = (w) => db.prepare(`select count(*) c from ormas where ${w}`).get().c;
  const ya = c(`legal_status='ya'`), tidak = c(`legal_status='tidak'`), belum_diisi = c(`coalesce(legal_status,'') not in ('ya','tidak')`);
  const belum = db.prepare(`select o.id,o.kode_ormas,o.nama_ormas,o.legal_status,k.nama_kategori from ormas o join kategori k on k.id=o.kategori_id where coalesce(o.legal_status,'')!='ya' order by (o.legal_status='tidak') desc,o.id limit 6`).all();
  return { ya, tidak, belum_diisi, total: ya + tidak + belum_diisi, belum };
}

// ---------- Batch 6: status dokumen ----------
const DOK_BERKAS = [['sk_pengurusan', 'SK Pengurusan'], ['surat_domisili', 'Surat Keterangan Domisili'], ['program_kerja', 'Program Kerja'], ['badan_hukum', 'Salinan Badan Hukum'], ['skto', 'SKTO'], ['adart', 'AD/ART'], ['company_profile', 'Company Profile']];
// Status: Aktif | Akan Berakhir (<= 90 hari) | Segera Diperbarui (<= 30 hari) | Kedaluwarsa | Belum Memiliki Data
const statusTanggal = (e) => e.status === 'kedaluwarsa' ? 'Kedaluwarsa' : e.status === 'segera' ? (e.hari <= 30 ? 'Segera Diperbarui' : 'Akan Berakhir') : e.status === 'aman' || e.status === 'seumur_hidup' ? 'Aktif' : 'Belum Memiliki Data';
const berakhirTeks = (e, mentah) => (e.tgl ? tglIndo(e.tgl) : e.status === 'seumur_hidup' ? 'Seumur hidup' : mentah || '');

function statusDokumen(o) {
  const files = new Map();
  db.prepare(`select id,jenis_dokumen,nama_file,uploaded_at from dokumen_ormas where ormas_id=? and pending=0 and jenis_dokumen is not null order by id`).all(o.id).forEach((d) => files.set(d.jenis_dokumen, d));
  const exp = expiryInfo(o);
  const out = DOK_BERKAS.map(([kunci, nama]) => {
    const f = files.get(kunci);
    if (kunci === 'skto') {
      const e = exp.skto;
      return { kunci, nama, tanggal_berlaku: o.skto_tahun || '', tanggal_berakhir: berakhirTeks(e, o.skto_berlaku_sd), status: statusTanggal(e), ada_berkas: !!f, hari: e.hari ?? null, bagian: 'skto' };
    }
    return { kunci, nama, tanggal_berlaku: f ? tglIndo(f.uploaded_at.slice(0, 10)) : '', tanggal_berakhir: '-', status: f ? 'Aktif' : 'Belum Memiliki Data', ada_berkas: !!f, hari: null, bagian: 'dokumen' };
  });
  const e = exp.legal, ls = o.legal_status || '';
  out.push({
    kunci: 'legal_standing', nama: 'Legal Standing', tanggal_berlaku: ls === 'ya' ? o.legal_tahun || '' : '', tanggal_berakhir: ls === 'ya' ? berakhirTeks(e, o.legal_berlaku_sd) : '-',
    status: ls === 'ya' ? statusTanggal(e) : 'Belum Memiliki Data', ada_berkas: false, hari: ls === 'ya' ? e.hari ?? null : null, bagian: 'legal',
    keterangan: ls === 'tidak' ? 'Ormas menyatakan belum memiliki Legal Standing' : ls === '' ? 'Status Legal Standing belum diisi' : '',
  });
  return out;
}

const PERLU_DIISI = [['nama_ketua', 'Nama Ketua', 'pengurus'], ['sekretaris', 'Nama Sekretaris', 'pengurus'], ['bendahara', 'Nama Bendahara', 'pengurus'], ['nomor_whatsapp_ketua', 'Nomor Telepon Ketua', 'kontak'], ['telepon_ormas', 'Nomor Telepon Ormas', 'kontak'], ['email_ormas', 'Email Ormas', 'kontak'], ['alamat', 'Alamat', 'kontak'], ['kemantren', 'Kemantren', 'kontak'], ['bentuk', 'Bentuk Ormas', 'identitas'], ['bidang_kegiatan', 'Bidang Kegiatan', 'identitas'], ['anggota_total', 'Jumlah Anggota', 'anggota'], ['legal_status', 'Status Legal Standing', 'legal']];

function companyProfile(o) {
  const ada = !!db.prepare(`select 1 from dokumen_ormas where ormas_id=? and jenis_dokumen='company_profile' and pending=0`).get(o.id);
  const cek = [
    { label: 'Berkas Company Profile terunggah', ok: ada },
    { label: 'Bagian Company Profile yang ditampilkan sudah dipilih', ok: !!String(o.cp_bagian || '').trim() },
    { label: 'Bidang kegiatan terisi', ok: !!String(o.bidang_kegiatan || '').trim() },
    { label: 'Alamat dan kontak terisi', ok: !!String(o.alamat || '').trim() && !!String(o.email_ormas || '').trim() },
    { label: 'Susunan pengurus lengkap', ok: !!(o.nama_ketua && o.sekretaris && o.bendahara) },
    { label: 'Jumlah anggota terisi', ok: o.anggota_total != null },
  ];
  const persen = Math.round((cek.filter((c) => c.ok).length / cek.length) * 100);
  return { persen, status: persen === 100 ? 'Lengkap' : persen === 0 ? 'Belum Diisi' : 'Belum Lengkap', cek };
}

function statusLaporan(ormasId) {
  const th = tahunIni();
  const get = (t) => db.prepare('select id,tahun,status,dikirim_at,updated_at from laporan_tahunan where ormas_id=? and tahun=?').get(ormasId, t);
  const lbl = (r) => (!r ? 'Belum Dibuat' : r.status === 'dikirim' ? 'Sudah Dikirim' : 'Draft');
  const ini = get(th), lalu = get(th - 1);
  return { tahun: th, status: lbl(ini), dikirim_at: ini?.dikirim_at || null, tahun_lalu: { tahun: th - 1, status: lbl(lalu) } };
}

function bangunNotifikasi(o, docs, laporan) {
  const n = [];
  const dyn = (kunci, kategori, jenis, judul, pesan, bagian = null) => n.push({ id: `dyn:${kunci}`, dinamis: true, kategori, jenis, judul, pesan, bagian, dibaca: false, created_at: null });
  if (o.catatan_penolakan && o.status_dokumen !== 'Perlu Diverifikasi') dyn('revisi', 'Required Action', 'revisi', 'Permintaan revisi dari Admin', o.catatan_penolakan, 'profil');
  for (const d of docs) {
    if (d.status === 'Kedaluwarsa') dyn(`exp:${d.kunci}`, 'Required Action', 'dokumen', `${d.nama} sudah kedaluwarsa`, `${d.nama} berakhir ${d.tanggal_berakhir}. Segera perbarui dokumen ini.`, d.bagian);
    else if (d.status === 'Segera Diperbarui') dyn(`exp:${d.kunci}`, 'Warning', 'dokumen', `${d.nama} segera berakhir`, `${d.nama} berakhir ${d.tanggal_berakhir}${d.hari != null ? ` (${d.hari} hari lagi)` : ''}. Segera perbarui.`, d.bagian);
    else if (d.status === 'Akan Berakhir') dyn(`exp:${d.kunci}`, 'Warning', 'dokumen', `${d.nama} akan berakhir`, `${d.nama} berakhir ${d.tanggal_berakhir}${d.hari != null ? ` (${d.hari} hari lagi)` : ''}.`, d.bagian);
  }
  const ls = o.legal_status || '';
  if (ls === '') dyn('legal', 'Required Action', 'legal', 'Status Legal Standing belum diisi', 'Pilih YA atau TIDAK pada pertanyaan "Apakah sudah memiliki Legal Standing?".', 'legal');
  else if (ls === 'tidak') dyn('legal', 'Information', 'legal', 'Ormas belum memiliki Legal Standing', 'Data Legal Standing tidak perlu diisi. Jika nanti sudah memiliki, ubah statusnya menjadi YA.', 'legal');
  if (laporan.status !== 'Sudah Dikirim') dyn(`laporan:${laporan.tahun}`, bulanIni() >= 10 ? 'Warning' : 'Information', 'laporan', `Laporan Kegiatan Tahunan ${laporan.tahun}`, `Laporan tahun ${laporan.tahun} berstatus ${laporan.status}. Setiap Ormas wajib mengirim laporan tahunan.`, 'laporan');
  if (laporan.tahun_lalu.status !== 'Sudah Dikirim') dyn(`laporan:${laporan.tahun_lalu.tahun}`, 'Warning', 'laporan', `Laporan Kegiatan Tahunan ${laporan.tahun_lalu.tahun} belum dikirim`, `Laporan tahun ${laporan.tahun_lalu.tahun} berstatus ${laporan.tahun_lalu.status}. Segera lengkapi dan kirim.`, 'laporan');
  const tersimpan = db.prepare('select id,kategori,jenis,judul,pesan,dibaca,created_at from notifikasi_ormas where ormas_id=? order by id desc limit 30').all(o.id).map((r) => ({ ...r, dinamis: false, dibaca: !!r.dibaca, bagian: null }));
  const peng = db.prepare('select id,kategori,judul,pesan,created_at from pengumuman where aktif=1 order by id desc limit 5').all().map((r) => ({ id: `peng:${r.id}`, dinamis: true, jenis: 'pengumuman', kategori: r.kategori, judul: r.judul, pesan: r.pesan, bagian: null, dibaca: false, created_at: r.created_at }));
  return [...n, ...tersimpan, ...peng].sort((a, b) => (URUT[a.kategori] ?? 3) - (URUT[b.kategori] ?? 3));
}

// ---------- Batch 7: validasi laporan ----------
const LAP_MAX = { rencana_program: 6000, pelaksanaan_kegiatan: 6000, sumber_dana: 500, dokumentasi_link: 500, penutup: 3000 };
const LAP_LABEL = { rencana_program: 'Rencana Program Kegiatan', pelaksanaan_kegiatan: 'Pelaksanaan Program Kegiatan', biaya_kegiatan: 'Besaran biaya kegiatan', sumber_dana: 'Sumber dana kegiatan', penutup: 'Penutup' };
function bacaLaporan(b) {
  const r = {};
  for (const [k, max] of Object.entries(LAP_MAX)) {
    r[k] = String(b[k] ?? '').trim();
    if (r[k].length > max) return { err: `${LAP_LABEL[k] || 'Dokumentasi kegiatan'} terlalu panjang (maks. ${max} karakter)` };
  }
  if (r.dokumentasi_link && !urlOk(r.dokumentasi_link)) return { err: 'Link dokumentasi harus berupa tautan yang diawali http:// atau https://' };
  const bt = String(b.biaya_kegiatan ?? '').replace(/[.\s]/g, '').trim();
  if (bt !== '' && !/^\d{1,13}$/.test(bt)) return { err: 'Besaran biaya harus berupa angka (rupiah, tanpa huruf)' };
  r.biaya_kegiatan = bt === '' ? null : +bt;
  return { r };
}
const tahunOk = (t) => Number.isInteger(t) && t >= 2000 && t <= tahunIni() + 1;
const labelLap = (r) => (!r ? 'Belum Dibuat' : r.status === 'dikirim' ? 'Sudah Dikirim' : 'Draft');

export function setupRevisi({ app, auth, portalAuth, log, portalWho }) {
  // ===== Portal Ormas: dashboard =====
  app.get('/api/portal/dashboard', portalAuth(), (req, res) => {
    const o = req.portal.ormas;
    const docs = statusDokumen(o);
    const laporan = statusLaporan(o.id);
    const perlu = PERLU_DIISI.filter(([k]) => String(o[k] ?? '').trim() === '').map(([k, label, bagian]) => ({ kunci: k, label, bagian }));
    const notif = bangunNotifikasi(o, docs, laporan);
    res.set('Cache-Control', 'no-store');
    res.json({
      nama_ormas: o.nama_ormas, kode_ormas: o.kode_ormas,
      profil: { status_dokumen: o.status_dokumen, status_operasional: o.status_operasional, status_publikasi: o.status_publikasi, menunggu_verifikasi: o.status_dokumen === 'Perlu Diverifikasi', diperbarui: o.updated_at },
      company_profile: companyProfile(o),
      legal_standing: { status: o.legal_status || '', jenis: o.legal_jenis || '', nomor: o.nomor_sk || '', tahun: o.legal_tahun || '', berlaku_sd: o.legal_berlaku_sd || '' },
      dokumen: docs,
      ringkasan_dokumen: { lengkap: docs.filter((d) => d.ada_berkas).length, total: docs.filter((d) => d.bagian !== 'legal').length },
      laporan_tahunan: laporan,
      perlu_diperbarui: perlu,
      catatan_admin: o.status_dokumen !== 'Perlu Diverifikasi' ? o.catatan_penolakan || '' : '',
      notifikasi: notif,
      perlu_tindakan: notif.filter((x) => (x.kategori === 'Required Action' || x.kategori === 'Warning') && !x.dibaca).length,
    });
  });
  app.post('/api/portal/notifikasi/baca-semua', portalAuth(), (req, res) => {
    db.prepare('update notifikasi_ormas set dibaca=1 where ormas_id=?').run(req.portal.ormas.id);
    res.json({ ok: true });
  });
  app.post('/api/portal/notifikasi/:id/baca', portalAuth(), (req, res) => {
    db.prepare('update notifikasi_ormas set dibaca=1 where id=? and ormas_id=?').run(+req.params.id, req.portal.ormas.id);
    res.json({ ok: true });
  });

  // ===== Portal Ormas: Laporan Kegiatan Tahunan =====
  app.get('/api/portal/laporan', portalAuth(), (req, res) => {
    const items = db.prepare('select id,tahun,status,dikirim_at,updated_at,catatan_admin from laporan_tahunan where ormas_id=? order by tahun desc').all(req.portal.ormas.id);
    res.json({ tahun_ini: tahunIni(), items: items.map((r) => ({ ...r, label: labelLap(r) })) });
  });
  app.get('/api/portal/laporan/:tahun', portalAuth(), (req, res) => {
    const t = +req.params.tahun;
    if (!tahunOk(t)) return res.status(400).json({ error: 'Tahun laporan tidak valid' });
    const r = db.prepare('select * from laporan_tahunan where ormas_id=? and tahun=?').get(req.portal.ormas.id, t);
    res.json(r ? { ...r, label: labelLap(r) } : { tahun: t, status: 'belum', label: 'Belum Dibuat', rencana_program: '', pelaksanaan_kegiatan: '', biaya_kegiatan: null, sumber_dana: '', dokumentasi_link: '', penutup: '', catatan_admin: '' });
  });
  // Simpan draft; dengan { kirim: true } laporan dikirim ke admin dan terkunci sebagai arsip
  app.put('/api/portal/laporan/:tahun', portalAuth(), (req, res) => {
    const o = req.portal.ormas, t = +req.params.tahun;
    if (!tahunOk(t)) return res.status(400).json({ error: 'Tahun laporan tidak valid' });
    const ex = db.prepare('select * from laporan_tahunan where ormas_id=? and tahun=?').get(o.id, t);
    if (ex?.status === 'dikirim') return res.status(409).json({ error: 'Laporan ini sudah dikirim dan tersimpan sebagai arsip. Hubungi Admin jika perlu direvisi.' });
    const { r, err } = bacaLaporan(req.body || {});
    if (err) return res.status(400).json({ error: err });
    const kirim = req.body?.kirim === true || req.body?.kirim === 'true';
    if (kirim) {
      const kosong = ['rencana_program', 'pelaksanaan_kegiatan', 'biaya_kegiatan', 'sumber_dana', 'penutup'].find((k) => r[k] === '' || r[k] === null);
      if (kosong) return res.status(400).json({ error: `${LAP_LABEL[kosong]} wajib diisi sebelum laporan dikirim` });
    }
    const w = now();
    db.prepare(`insert into laporan_tahunan(ormas_id,tahun,rencana_program,pelaksanaan_kegiatan,biaya_kegiatan,sumber_dana,dokumentasi_link,penutup,status,dikirim_at,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,?,?)
      on conflict(ormas_id,tahun) do update set rencana_program=excluded.rencana_program,pelaksanaan_kegiatan=excluded.pelaksanaan_kegiatan,biaya_kegiatan=excluded.biaya_kegiatan,sumber_dana=excluded.sumber_dana,dokumentasi_link=excluded.dokumentasi_link,penutup=excluded.penutup,status=excluded.status,dikirim_at=excluded.dikirim_at,updated_at=excluded.updated_at`)
      .run(o.id, t, r.rencana_program, r.pelaksanaan_kegiatan, r.biaya_kegiatan, r.sumber_dana, r.dokumentasi_link, r.penutup, kirim ? 'dikirim' : 'draft', kirim ? w : null, ex?.created_at || w, w);
    log(req, kirim ? 'kirim_laporan_tahunan' : 'simpan_laporan_tahunan', o.id, `${kirim ? 'Mengirim' : 'Menyimpan draft'} Laporan Kegiatan Tahunan ${t}`, 'berhasil', portalWho(req.portal));
    if (kirim) notify({ jenis: 'ormas', judul: `${o.kode_ormas} mengirim Laporan Kegiatan Tahunan ${t}`, pesan: `Ormas (${o.nama_ormas}) mengirim Laporan Kegiatan Tahunan ${t}, CEK SELENGKAPNYA!`, ormasId: o.id });
    res.json({ ok: true, status: kirim ? 'dikirim' : 'draft' });
  });

  // ===== Admin: monitoring Legal Standing =====
  app.get('/api/admin/legal-standing', auth('view_ormas'), (req, res) => {
    const st = String(req.query.status || '');
    const w = [], p = [];
    if (st === 'ya') w.push(`o.legal_status='ya'`); else if (st === 'tidak') w.push(`o.legal_status='tidak'`); else if (st === 'belum_diisi') w.push(`coalesce(o.legal_status,'') not in ('ya','tidak')`);
    if (req.query.q) { w.push('(o.nama_ormas like ? or o.kode_ormas like ?)'); p.push(`%${req.query.q}%`, `%${req.query.q}%`); }
    const items = db.prepare(`select o.id,o.kode_ormas,o.nama_ormas,o.legal_status,o.legal_jenis,o.nomor_sk,o.legal_tahun,o.legal_berlaku_sd,k.nama_kategori from ormas o join kategori k on k.id=o.kategori_id ${w.length ? 'where ' + w.join(' and ') : ''} order by o.id`).all(...p);
    res.json({ stats: legalStats(), items });
  });

  // ===== Admin: laporan kegiatan tahunan =====
  app.get('/api/admin/laporan', auth('view_ormas'), (req, res) => {
    const t = tahunOk(+req.query.tahun) ? +req.query.tahun : tahunIni();
    const w = [], p = [t];
    if (req.query.q) { w.push('(o.nama_ormas like ? or o.kode_ormas like ?)'); p.push(`%${req.query.q}%`, `%${req.query.q}%`); }
    const st = String(req.query.status || '');
    if (st === 'belum') w.push('l.id is null'); else if (st === 'draft') w.push(`l.status='draft'`); else if (st === 'dikirim') w.push(`l.status='dikirim'`);
    const items = db.prepare(`select o.id ormas_id,o.kode_ormas,o.nama_ormas,k.nama_kategori,l.id laporan_id,l.status,l.dikirim_at,l.updated_at from ormas o join kategori k on k.id=o.kategori_id left join laporan_tahunan l on l.ormas_id=o.id and l.tahun=? ${w.length ? 'where ' + w.join(' and ') : ''} order by o.id`).all(...p);
    const tot = db.prepare('select count(*) c from ormas').get().c;
    const dikirim = db.prepare(`select count(*) c from laporan_tahunan where tahun=? and status='dikirim'`).get(t).c;
    const draft = db.prepare(`select count(*) c from laporan_tahunan where tahun=? and status='draft'`).get(t).c;
    const tahunList = [...new Set([tahunIni(), ...db.prepare('select distinct tahun from laporan_tahunan').all().map((x) => x.tahun)])].sort((a, b) => b - a);
    res.json({ tahun: t, tahun_list: tahunList, stats: { total_ormas: tot, dikirim, draft, belum: Math.max(0, tot - dikirim - draft) }, items: items.map((i) => ({ ...i, label: labelLap(i.laporan_id ? i : null) })) });
  });
  app.get('/api/admin/laporan/:id', auth('view_ormas'), (req, res) => {
    const r = db.prepare('select l.*,o.kode_ormas,o.nama_ormas from laporan_tahunan l join ormas o on o.id=l.ormas_id where l.id=?').get(+req.params.id);
    if (!r) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    res.json({ ...r, label: labelLap(r) });
  });
  app.get('/api/admin/ormas/:id/laporan', auth('view_ormas'), (req, res) => {
    res.json({ items: db.prepare('select id,tahun,status,dikirim_at,updated_at from laporan_tahunan where ormas_id=? order by tahun desc').all(+req.params.id).map((r) => ({ ...r, label: labelLap(r) })) });
  });
  // Admin membuka kembali laporan terkirim agar bisa direvisi Ormas (arsip lama tidak dihapus), disertai catatan
  app.post('/api/admin/laporan/:id/buka-kembali', auth('manage_ormas'), (req, res) => {
    const r = db.prepare('select l.*,o.kode_ormas,o.nama_ormas from laporan_tahunan l join ormas o on o.id=l.ormas_id where l.id=?').get(+req.params.id);
    if (!r) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    const cat = String(req.body?.catatan || '').trim().slice(0, 900);
    if (!cat) return res.status(400).json({ error: 'Catatan revisi wajib diisi' });
    db.prepare(`update laporan_tahunan set status='draft',catatan_admin=?,updated_at=? where id=?`).run(cat, now(), r.id);
    db.prepare(`insert into notifikasi_ormas(ormas_id,kategori,jenis,judul,pesan,kunci,created_at) values(?,?,?,?,?,?,?)`).run(r.ormas_id, 'Required Action', 'revisi', `Permintaan revisi Laporan Kegiatan Tahunan ${r.tahun}`, cat, `lap:${r.id}:${Date.now()}`, now());
    log(req, 'revisi_laporan_tahunan', r.ormas_id, `Meminta revisi laporan tahunan ${r.tahun} ${r.kode_ormas}`);
    res.json({ ok: true });
  });

  // ===== Admin: catatan untuk Ormas dan pengumuman SIDOMAS =====
  app.post('/api/admin/ormas/:id/catatan', auth('manage_ormas'), (req, res) => {
    const o = db.prepare('select id,kode_ormas from ormas where id=?').get(+req.params.id);
    if (!o) return res.status(404).json({ error: 'Data tidak ditemukan' });
    const pesan = String(req.body?.pesan || '').trim().slice(0, 900), kategori = KATEGORI.includes(req.body?.kategori) ? req.body.kategori : 'Information';
    if (!pesan) return res.status(400).json({ error: 'Isi catatan wajib diisi' });
    db.prepare(`insert into notifikasi_ormas(ormas_id,kategori,jenis,judul,pesan,kunci,created_at) values(?,?,?,?,?,?,?)`).run(o.id, kategori, 'catatan_admin', 'Catatan Admin', pesan, `cat:${Date.now()}`, now());
    log(req, 'catatan_admin_ormas', o.id, `Mengirim catatan ke ${o.kode_ormas}`);
    res.json({ ok: true });
  });
  app.get('/api/admin/pengumuman', auth('view_ormas'), (req, res) => res.json({ items: db.prepare('select * from pengumuman order by id desc limit 50').all() }));
  app.post('/api/admin/pengumuman', auth('manage_ormas'), (req, res) => {
    const judul = String(req.body?.judul || '').trim().slice(0, 150), pesan = String(req.body?.pesan || '').trim().slice(0, 900), kategori = KATEGORI.includes(req.body?.kategori) ? req.body.kategori : 'Information';
    if (!judul || !pesan) return res.status(400).json({ error: 'Judul dan isi pengumuman wajib diisi' });
    const id = db.prepare('insert into pengumuman(kategori,judul,pesan,created_by,created_at) values(?,?,?,?,?)').run(kategori, judul, pesan, req.admin.id, now()).lastInsertRowid;
    log(req, 'pengumuman', null, `Membuat pengumuman SIDOMAS: ${judul}`);
    res.json({ id });
  });
  app.delete('/api/admin/pengumuman/:id', auth('manage_ormas'), (req, res) => {
    db.prepare('delete from pengumuman where id=?').run(+req.params.id);
    log(req, 'pengumuman', null, 'Menghapus pengumuman SIDOMAS');
    res.json({ ok: true });
  });
}
