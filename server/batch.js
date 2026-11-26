// Revisi SIDOMAS Batch 4-7:
//  - Batch 4: status kepemilikan Legal Standing (ya/tidak) + monitoring admin
//  - Batch 5: nomor telepon ketua (disamarkan di katalog publik) dan nomor telepon ormas (terpisah)
//  - Batch 6: dashboard ormas (status, masa berlaku dokumen, notifikasi, pengumuman)
//  - Batch 7: laporan kegiatan tahunan per tahun (arsip, monitoring admin)
import { db } from './db.js';
import { expiryInfo, notify, tglIndo } from './fitur.js';

const now = () => new Date().toISOString();
const todayJkt = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
const tahunIni = () => +todayJkt().slice(0, 4);
const urlOk = (v) => { try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } };

// ---------- Batch 4: Legal Standing ----------
export const LEGAL_STATUS = ['', 'ya', 'tidak'];
const LEGAL_FIELDS = ['legal_jenis', 'nomor_sk', 'legal_tahun', 'legal_berlaku_sd'];
// Jika ormas menyatakan belum memiliki Legal Standing, isian dokumennya dikosongkan (status "tidak" tetap tersimpan di database).
export function normalizeLegal(row) {
  const s = String(row.legal_status ?? '').trim().toLowerCase();
  row.legal_status = LEGAL_STATUS.includes(s) ? s : '';
  if (row.legal_status === 'tidak') for (const k of LEGAL_FIELDS) row[k] = '';
  return row;
}
// Ringkasan untuk dashboard admin: jumlah yang sudah / belum memiliki Legal Standing + daftar yang perlu perhatian.
export function legalStats() {
  const r = db.prepare(`select coalesce(legal_status,'') s, count(*) c from ormas group by 1`).all();
  const n = (s) => r.find((x) => x.s === s)?.c || 0;
  const ya = n('ya'), tidak = n('tidak'), belum = n('');
  return {
    ya, tidak, belum, total: ya + tidak + belum,
    items: db.prepare(`select id,kode_ormas,nama_ormas,coalesce(legal_status,'') legal_status from ormas where coalesce(legal_status,'')!='ya' order by (coalesce(legal_status,'')='tidak') desc, id limit 8`).all(),
  };
}

// ---------- Batch 5: privasi nomor telepon ----------
// Nomor ketua di katalog publik disamarkan di SERVER (bukan hanya tampilan): 081234567823 -> 08********23
export const maskPhone = (raw) => {
  const s = String(raw ?? '').replace(/[\s-]/g, '');
  if (!s) return '';
  if (s.length <= 4) return '*'.repeat(s.length);
  return s.slice(0, 2) + '*'.repeat(s.length - 4) + s.slice(-2);
};

// ---------- Batch 6: notifikasi ormas ----------
export const KATEGORI_NOTIF = ['Information', 'Warning', 'Required Action'];
export function notifOrmas(ormasId, { kategori = 'Information', jenis = 'info', judul, pesan, kunci = null }) {
  try {
    const k = KATEGORI_NOTIF.includes(kategori) ? kategori : 'Information';
    db.prepare('insert or ignore into notifikasi_ormas(ormas_id,kategori,jenis,judul,pesan,kunci,dibaca,created_at) values(?,?,?,?,?,?,0,?)').run(ormasId, k, jenis, judul, pesan, kunci, now());
    return true;
  } catch (e) { console.error('Gagal membuat notifikasi ormas:', e.message); return false; }
}

// Pengingat otomatis untuk ormas: dokumen hampir/sudah kedaluwarsa, konfirmasi Legal Standing, Laporan Kegiatan Tahunan.
export function cekPengingatOrmas() {
  try {
    const th = tahunIni(), bln = +todayJkt().slice(5, 7);
    const sudah = new Set(db.prepare(`select ormas_id,tahun from laporan_tahunan where status='dikirim'`).all().map((x) => `${x.ormas_id}:${x.tahun}`));
    db.transaction(() => {
      for (const o of db.prepare('select * from ormas').all()) {
        const e = expiryInfo(o);
        for (const [jenis, x] of [['SKTO', e.skto], ['Legal Standing', e.legal]]) {
          if (!x.tgl || x.hari > 30) continue;
          const lewat = x.hari < 0;
          notifOrmas(o.id, {
            kategori: lewat ? 'Required Action' : 'Warning', jenis: 'kedaluwarsa', kunci: `exp:${jenis}:${x.tgl}:${lewat ? 'lewat' : '30'}`,
            judul: `${jenis} ${lewat ? 'sudah kedaluwarsa' : 'segera berakhir'}`,
            pesan: `${jenis} berlaku s/d ${tglIndo(x.tgl)} (${lewat ? `sudah lewat ${-x.hari} hari` : x.hari === 0 ? 'berakhir hari ini' : `${x.hari} hari lagi`}). Mohon perbarui lewat menu Data Ormas.`,
          });
        }
        const ls = o.legal_status || '';
        if (ls === '') notifOrmas(o.id, { kategori: 'Required Action', jenis: 'legal', kunci: 'legal:konfirmasi', judul: 'Konfirmasi status Legal Standing', pesan: 'Mohon jawab pertanyaan "Apakah sudah memiliki Legal Standing?" pada menu Data Ormas.' });
        else if (ls === 'tidak') notifOrmas(o.id, { kategori: 'Information', jenis: 'legal', kunci: 'legal:tidak', judul: 'Informasi Legal Standing', pesan: 'Ormas Anda tercatat belum memiliki Legal Standing, jadi Anda tidak perlu mengisi data dokumennya. Jika nanti sudah memilikinya, ubah statusnya di menu Data Ormas.' });
        const mulai = +String(o.created_at).slice(0, 4) || th;
        if (th - 1 >= mulai && !sudah.has(`${o.id}:${th - 1}`)) notifOrmas(o.id, { kategori: 'Required Action', jenis: 'laporan', kunci: `lap:${th - 1}:belum`, judul: `Laporan Kegiatan Tahunan ${th - 1} belum dikirim`, pesan: `Ormas wajib mengirim Laporan Kegiatan Tahunan ${th - 1}. Buka menu Laporan Tahunan untuk menyusunnya.` });
        if (!sudah.has(`${o.id}:${th}`)) {
          if (bln >= 12) notifOrmas(o.id, { kategori: 'Required Action', jenis: 'laporan', kunci: `lap:${th}:des`, judul: `Laporan Kegiatan Tahunan ${th} belum dikirim`, pesan: `Tahun ${th} hampir berakhir. Segera kirim Laporan Kegiatan Tahunan ${th} lewat menu Laporan Tahunan.` });
          else if (bln >= 9) notifOrmas(o.id, { kategori: 'Warning', jenis: 'laporan', kunci: `lap:${th}:sep`, judul: `Pengingat Laporan Kegiatan Tahunan ${th}`, pesan: `Laporan Kegiatan Tahunan ${th} belum dikirim. Mulai susun dan kirim lewat menu Laporan Tahunan.` });
        }
      }
    })();
  } catch (e) { console.error('Pengecekan pengingat ormas gagal:', e.message); }
}

// ---------- Batch 6: data dashboard ormas ----------
const CP_LABEL = { deskripsi: 'Deskripsi singkat ormas', visi: 'Visi', misi: 'Misi', legal: 'Legal Standing', bidang: 'Cakupan kegiatan / bidang', dana: 'Sumber dana', anggota: 'Profil anggota', pengurus: 'Susunan pengurus', program: 'Program kegiatan' };
const PDF_WAJIB = [['sk_pengurusan', 'SK Pengurusan'], ['surat_domisili', 'Surat Keterangan Domisili'], ['program_kerja', 'Program Kerja'], ['badan_hukum', 'Salinan Badan Hukum']];
// Status per dokumen: Aktif | Akan Berakhir (<= 90 hari) | Segera Diperbarui (<= 30 hari) | Kedaluwarsa | Belum Memiliki Data
const statusMasa = (e, adaData) => {
  if (e.status === 'kedaluwarsa') return 'Kedaluwarsa';
  if (e.status === 'segera') return e.hari <= 30 ? 'Segera Diperbarui' : 'Akan Berakhir';
  if (e.status === 'aman' || e.status === 'seumur_hidup') return 'Aktif';
  if (e.status === 'tidak_terbaca') return 'Segera Diperbarui';
  return adaData ? 'Aktif' : 'Belum Memiliki Data';
};

export function dashboardOf(o) {
  const th = tahunIni();
  const files = db.prepare('select jenis_dokumen,nama_file,uploaded_at,pending from dokumen_ormas where ormas_id=? and jenis_dokumen is not null order by pending, id').all(o.id);
  const has = (j) => files.find((d) => d.jenis_dokumen === j);
  const e = expiryInfo(o), ls = o.legal_status || '';
  const berakhir = (x, raw) => (x.tgl ? tglIndo(x.tgl) : x.status === 'seumur_hidup' ? 'Seumur hidup' : raw || null);
  const diunggah = (d) => (d ? `Diunggah ${tglIndo(String(d.uploaded_at).slice(0, 10))}` : null);

  const dok = [];
  dok.push({ kode: 'skto', nama: 'SKTO', tanggal_berlaku: o.skto_tahun ? `Tahun ${o.skto_tahun}` : null, tanggal_berakhir: berakhir(e.skto, o.skto_berlaku_sd), hari: e.skto.hari ?? null, status: statusMasa(e.skto, !!(o.skto_nomor || has('skto'))), keterangan: has('skto') ? (has('skto').pending ? 'PDF menunggu verifikasi admin' : null) : 'PDF SKTO belum diunggah', link: '/portal/data#sec-skto' });
  if (ls === 'tidak') dok.push({ kode: 'legal', nama: 'Legal Standing', tanggal_berlaku: null, tanggal_berakhir: null, hari: null, status: 'Belum Memiliki Data', keterangan: 'Ormas belum memiliki Legal Standing (tidak wajib diisi)', link: '/portal/data#sec-legal' });
  else dok.push({ kode: 'legal', nama: 'Legal Standing', tanggal_berlaku: o.legal_tahun ? `Tahun ${o.legal_tahun}` : null, tanggal_berakhir: berakhir(e.legal, o.legal_berlaku_sd), hari: e.legal.hari ?? null, status: ls === 'ya' ? statusMasa(e.legal, !!(o.legal_jenis || o.nomor_sk)) : 'Belum Memiliki Data', keterangan: ls === 'ya' ? null : 'Status Legal Standing belum dikonfirmasi', link: '/portal/data#sec-legal' });
  for (const [j, l] of PDF_WAJIB) {
    const d = has(j);
    dok.push({ kode: j, nama: l, tanggal_berlaku: diunggah(d), tanggal_berakhir: null, hari: null, status: d ? 'Aktif' : 'Belum Memiliki Data', keterangan: d ? (d.pending ? 'Menunggu verifikasi admin' : 'Tanpa masa berlaku') : 'Belum diunggah', link: '/portal/data#sec-dokumen' });
  }
  for (const [j, l] of [['adart', 'AD/ART'], ['company_profile', 'Company Profile']]) {
    const d = has(j);
    dok.push({ kode: j, nama: l, opsional: true, tanggal_berlaku: diunggah(d), tanggal_berakhir: null, hari: null, status: d ? 'Aktif' : 'Belum Memiliki Data', keterangan: d ? (d.pending ? 'Menunggu verifikasi admin' : 'Tanpa masa berlaku') : 'Dokumen opsional, belum diunggah', link: '/portal/data#sec-dokumen-tambahan' });
  }
  const wajib = dok.filter((d) => !d.opsional);
  const hitung = (s) => wajib.filter((d) => d.status === s).length;

  const cpSel = new Set(String(o.cp_bagian || '').split(',').filter(Boolean));
  const cpKurang = Object.keys(CP_LABEL).filter((k) => !cpSel.has(k)).map((k) => CP_LABEL[k]);
  const cpFile = !!has('company_profile');
  const cp = { ada_file: cpFile, terisi: Object.keys(CP_LABEL).length - cpKurang.length, total: Object.keys(CP_LABEL).length, kurang: cpKurang, status: !cpFile ? 'Belum diunggah' : cpKurang.length ? 'Belum lengkap' : 'Lengkap', link: '/portal/data#sec-company-profile' };

  const lap = db.prepare('select tahun,status,dikirim_at,catatan_admin from laporan_tahunan where ormas_id=? order by tahun desc').all(o.id);
  const cur = lap.find((x) => x.tahun === th);
  const mulai = +String(o.created_at).slice(0, 4) || th;
  const lapLalu = th - 1 >= mulai && !lap.some((x) => x.tahun === th - 1 && x.status === 'dikirim');
  const laporan = { tahun: th, status: cur?.status || 'belum', dikirim_at: cur?.dikirim_at || null, arsip: lap.filter((x) => x.status === 'dikirim').length, tahun_lalu_belum: lapLalu ? th - 1 : null, link: '/portal/laporan' };

  const cek = [
    ['Identitas Ormas (logo, bentuk, bidang kegiatan, kemantren)', 'sec-identitas', !!(o.logo_key && o.bentuk && o.bidang_kegiatan && o.kemantren)],
    ['Nama Pengurus', 'sec-pengurus', !!(o.nama_ketua && o.sekretaris && o.bendahara)],
    ['Kontak dan Alamat (telepon ketua, telepon ormas, email, alamat)', 'sec-kontak', !!(o.nomor_whatsapp_ketua && o.telepon_ormas && o.email_ormas && o.alamat)],
    ['Jumlah Anggota', 'sec-anggota', o.anggota_total != null],
    [ls === '' ? 'Legal Standing (jawab pertanyaan kepemilikan)' : 'Legal Standing (lengkapi jenis dan nomor)', 'sec-legal', ls === 'tidak' || (ls === 'ya' && !!(o.legal_jenis && o.nomor_sk))],
    ['Dokumen wajib (PDF)', 'sec-dokumen', PDF_WAJIB.every(([j]) => has(j)) && !!has('skto')],
  ];
  const perlu = cek.filter((c) => !c[2]).map(([label, id]) => ({ label, link: `/portal/data#${id}` }));
  if (cp.status !== 'Lengkap') perlu.push({ label: `Company Profile (${cp.status.toLowerCase()})`, link: cp.link });
  for (const d of dok.filter((x) => ['Akan Berakhir', 'Segera Diperbarui', 'Kedaluwarsa'].includes(x.status))) perlu.push({ label: `${d.nama} (${d.status.toLowerCase()})`, link: d.link });
  if (laporan.status === 'belum' || laporan.status === 'draft' || laporan.status === 'revisi') perlu.push({ label: `Laporan Kegiatan Tahunan ${th} (${laporan.status === 'belum' ? 'belum dibuat' : laporan.status === 'draft' ? 'masih draf' : 'perlu revisi'})`, link: laporan.link });
  if (lapLalu) perlu.push({ label: `Laporan Kegiatan Tahunan ${th - 1} belum dikirim`, link: laporan.link });

  const catatan = [];
  if (o.catatan_penolakan) catatan.push({ jenis: 'Permintaan revisi', teks: o.catatan_penolakan, link: '/portal/data' });
  if (o.catatan_verifikasi) catatan.push({ jenis: 'Catatan Admin', teks: o.catatan_verifikasi });
  for (const l of lap) if (l.status === 'revisi' && l.catatan_admin) catatan.push({ jenis: `Revisi Laporan ${l.tahun}`, teks: l.catatan_admin, link: '/portal/laporan' });

  return {
    kode_ormas: o.kode_ormas, nama_ormas: o.nama_ormas,
    profil: { status_dokumen: o.status_dokumen, status_operasional: o.status_operasional, status_publikasi: o.status_publikasi, menunggu_verifikasi: !!db.prepare('select 1 from perubahan_ormas where ormas_id=?').get(o.id), updated_at: o.updated_at, lengkap: cek.filter((c) => c[2]).length, total: cek.length },
    company_profile: cp,
    legal: { status: ls, jenis: o.legal_jenis || '', nomor: o.nomor_sk || '', tahun: o.legal_tahun || '', berlaku_sd: berakhir(e.legal, o.legal_berlaku_sd) },
    dokumen: dok,
    ringkasan_dokumen: { aktif: hitung('Aktif'), akan_berakhir: hitung('Akan Berakhir'), segera_diperbarui: hitung('Segera Diperbarui'), kedaluwarsa: hitung('Kedaluwarsa'), belum: hitung('Belum Memiliki Data') },
    akan_habis: dok.filter((d) => ['Akan Berakhir', 'Segera Diperbarui', 'Kedaluwarsa'].includes(d.status)),
    laporan, perlu_diperbarui: perlu, catatan_admin: catatan,
    notifikasi: {
      unread: db.prepare('select count(*) c from notifikasi_ormas where ormas_id=? and dibaca=0').get(o.id).c,
      items: db.prepare('select id,kategori,jenis,judul,pesan,dibaca,created_at from notifikasi_ormas where ormas_id=? order by id desc limit 30').all(o.id).map((x) => ({ ...x, dibaca: !!x.dibaca })),
    },
    pengumuman: db.prepare('select id,kategori,judul,pesan,created_at from pengumuman where aktif=1 order by id desc limit 5').all(),
  };
}

// ---------- Batch 7: laporan kegiatan tahunan ----------
const LAP_TEXT = { rencana_program: ['Rencana program kegiatan', 5000], pelaksanaan_kegiatan: ['Pelaksanaan program kegiatan', 5000], sumber_dana: ['Sumber dana kegiatan', 500], penutup: ['Penutup', 3000], dokumentasi_link: ['Link dokumentasi', 500] };
const LAP_COLS = `id,ormas_id,tahun,rencana_program,pelaksanaan_kegiatan,biaya_kegiatan,sumber_dana,dokumentasi_link,dokumentasi_nama,penutup,status,catatan_admin,dikirim_at,created_at,updated_at,(coalesce(dokumentasi_key,'')!='') as ada_dok`;
function bacaLaporan(b, kirim) {
  const v = {};
  for (const [k, [label, max]] of Object.entries(LAP_TEXT)) {
    v[k] = String(b[k] ?? '').trim();
    if (v[k].length > max) return { err: `Isian "${label}" terlalu panjang (maks. ${max} karakter)` };
  }
  const bi = String(b.biaya_kegiatan ?? '').trim();
  if (bi !== '' && !/^\d{1,13}$/.test(bi)) return { err: 'Besaran biaya kegiatan harus berupa angka rupiah tanpa titik atau koma' };
  v.biaya_kegiatan = bi === '' ? null : +bi;
  if (v.dokumentasi_link && !urlOk(v.dokumentasi_link)) return { err: 'Link dokumentasi harus diawali http:// atau https://' };
  if (kirim) {
    for (const k of ['rencana_program', 'pelaksanaan_kegiatan', 'sumber_dana', 'penutup']) if (!v[k]) return { err: `Isi "${LAP_TEXT[k][0]}" sebelum mengirim laporan` };
    if (v.biaya_kegiatan == null) return { err: 'Isi besaran biaya kegiatan sebelum mengirim laporan (isi 0 bila tidak ada biaya)' };
  }
  return { v };
}

export function laporanStats() {
  const th = tahunIni();
  const r = db.prepare(`select count(*) total, sum(l.status='dikirim') dikirim, sum(l.status='draft') draft, sum(l.status='revisi') revisi, sum(l.id is null) belum from ormas o left join laporan_tahunan l on l.ormas_id=o.id and l.tahun=? where (cast(substr(o.created_at,1,4) as integer) <= ? or l.id is not null)`).get(th, th);
  return { tahun: th, total: r.total || 0, dikirim: r.dikirim || 0, draft: r.draft || 0, revisi: r.revisi || 0, belum: r.belum || 0 };
}

export function setupBatch({ app, auth, portalAuth, upload, toDrive, fail, removeStored, sendPdf, cleanName, organizeOrmas, log, notifAdmin }) {
  const portalWho = (s) => ({ username: s.akun.username, nama_role: 'Ormas' });

  // ===== Dashboard ormas (Batch 6) =====
  app.get('/api/portal/dashboard', portalAuth(), (req, res) => { res.set('Cache-Control', 'no-store'); res.json(dashboardOf(req.portal.ormas)); });
  app.post('/api/portal/notifikasi/read-all', portalAuth(), (req, res) => {
    db.prepare('update notifikasi_ormas set dibaca=1 where ormas_id=?').run(req.portal.ormas.id);
    res.json({ ok: true });
  });
  app.post('/api/portal/notifikasi/:id/read', portalAuth(), (req, res) => {
    db.prepare('update notifikasi_ormas set dibaca=1 where id=? and ormas_id=?').run(+req.params.id, req.portal.ormas.id);
    res.json({ ok: true });
  });

  // ===== Laporan tahunan: sisi ormas (Batch 7) =====
  app.get('/api/portal/laporan', portalAuth(), (req, res) => {
    const th = tahunIni();
    res.json({ tahun_ini: th, tahun_min: th - 10, items: db.prepare(`select id,tahun,status,dikirim_at,updated_at,catatan_admin,biaya_kegiatan,(coalesce(dokumentasi_key,'')!='') as ada_dok from laporan_tahunan where ormas_id=? order by tahun desc`).all(req.portal.ormas.id) });
  });
  app.get('/api/portal/laporan/:tahun', portalAuth(), (req, res) => {
    const th = +req.params.tahun;
    if (!Number.isInteger(th)) return res.status(400).json({ error: 'Tahun laporan tidak valid' });
    const l = db.prepare(`select ${LAP_COLS} from laporan_tahunan where ormas_id=? and tahun=?`).get(req.portal.ormas.id, th);
    res.json(l || { tahun: th, status: 'belum' });
  });
  app.get('/api/portal/laporan/:tahun/dokumentasi', portalAuth(), (req, res) => {
    const l = db.prepare('select * from laporan_tahunan where ormas_id=? and tahun=?').get(req.portal.ormas.id, +req.params.tahun);
    if (!l?.dokumentasi_key) return res.status(404).json({ error: 'Dokumentasi tidak ditemukan' });
    req.admin = portalWho(req.portal);
    sendPdf(req, res, { storage_key: l.dokumentasi_key, mime_type: 'application/pdf', nama_file: l.dokumentasi_nama || 'dokumentasi.pdf', pending: 0, ormas_id: l.ormas_id }, req.query.dl === '1', 'akses_dokumen_ormas');
  });
  // aksi=simpan (draf) atau aksi=kirim. Laporan yang sudah dikirim terkunci kecuali admin meminta revisi.
  app.put('/api/portal/laporan/:tahun', portalAuth(), upload, toDrive, (req, res) => {
    const o = req.portal.ormas, th = +req.params.tahun, kirim = req.body?.aksi === 'kirim';
    if (!Number.isInteger(th) || th < tahunIni() - 10 || th > tahunIni()) return fail(req, res, 'Tahun laporan tidak valid');
    const ex = db.prepare('select * from laporan_tahunan where ormas_id=? and tahun=?').get(o.id, th);
    if (ex?.status === 'dikirim') return fail(req, res, 'Laporan yang sudah dikirim tidak dapat diubah. Hubungi admin bila perlu revisi.', 409);
    const { v, err } = bacaLaporan(req.body || {}, kirim); if (err) return fail(req, res, err);
    const f = req.files?.dokumentasi?.[0], rmDok = req.body?.hapus_dokumentasi === '1' && !f;
    const dokKey = f ? f.filename : rmDok ? null : ex?.dokumentasi_key ?? null;
    const dokNama = f ? cleanName(f.originalname) : rmDok ? null : ex?.dokumentasi_nama ?? null;
    const status = kirim ? 'dikirim' : ex?.status === 'revisi' ? 'revisi' : 'draft';
    const t = now(), kirimAt = kirim ? t : ex?.dikirim_at ?? null;
    db.transaction(() => {
      if (ex) db.prepare('update laporan_tahunan set rencana_program=?,pelaksanaan_kegiatan=?,biaya_kegiatan=?,sumber_dana=?,dokumentasi_link=?,dokumentasi_key=?,dokumentasi_nama=?,penutup=?,status=?,dikirim_at=?,updated_at=? where id=?')
        .run(v.rencana_program, v.pelaksanaan_kegiatan, v.biaya_kegiatan, v.sumber_dana, v.dokumentasi_link, dokKey, dokNama, v.penutup, status, kirimAt, t, ex.id);
      else db.prepare('insert into laporan_tahunan(ormas_id,tahun,rencana_program,pelaksanaan_kegiatan,biaya_kegiatan,sumber_dana,dokumentasi_link,dokumentasi_key,dokumentasi_nama,penutup,status,dikirim_at,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(o.id, th, v.rencana_program, v.pelaksanaan_kegiatan, v.biaya_kegiatan, v.sumber_dana, v.dokumentasi_link, dokKey, dokNama, v.penutup, status, kirimAt, t, t);
    })();
    if (ex?.dokumentasi_key && (f || rmDok)) removeStored(ex.dokumentasi_key);
    organizeOrmas(o.id);
    log(req, 'laporan_tahunan', o.id, `${kirim ? 'Mengirim' : 'Menyimpan draf'} Laporan Kegiatan Tahunan ${th}`, 'berhasil', portalWho(req.portal));
    if (kirim) {
      notify({ jenis: 'ormas', judul: `${o.kode_ormas} mengirim Laporan Tahunan ${th}`, pesan: `Ormas (${o.nama_ormas}) mengirim Laporan Kegiatan Tahunan ${th}, CEK SELENGKAPNYA!`, ormasId: o.id });
      notifOrmas(o.id, { kategori: 'Information', jenis: 'laporan', judul: `Laporan Kegiatan Tahunan ${th} terkirim`, pesan: `Laporan Kegiatan Tahunan ${th} sudah diterima admin dan tersimpan sebagai arsip.` });
    }
    res.json({ ok: true, status });
  });

  // ===== Laporan tahunan: sisi admin (monitoring semua ormas) =====
  const summary = (th) => {
    const r = db.prepare(`select count(*) total, sum(l.status='dikirim') dikirim, sum(l.status='draft') draft, sum(l.status='revisi') revisi, sum(l.id is null) belum from ormas o left join laporan_tahunan l on l.ormas_id=o.id and l.tahun=? where (cast(substr(o.created_at,1,4) as integer) <= ? or l.id is not null)`).get(th, th);
    return { total: r.total || 0, dikirim: r.dikirim || 0, draft: r.draft || 0, revisi: r.revisi || 0, belum: r.belum || 0 };
  };
  app.get('/api/admin/laporan', auth('view_ormas'), (req, res) => {
    const th = Math.min(tahunIni(), Math.max(2000, +req.query.tahun || tahunIni()));
    const status = String(req.query.status || ''), q = String(req.query.q || '').trim();
    const page = Math.max(1, +req.query.page || 1), size = 15;
    const w = ['(cast(substr(o.created_at,1,4) as integer) <= ? or l.id is not null)'], p = [th, th];
    if (q) { w.push('(o.nama_ormas like ? or o.kode_ormas like ?)'); p.push(`%${q}%`, `%${q}%`); }
    if (status === 'belum') w.push('l.id is null');
    else if (['draft', 'dikirim', 'revisi'].includes(status)) { w.push('l.status=?'); p.push(status); }
    const from = `from ormas o left join laporan_tahunan l on l.ormas_id=o.id and l.tahun=? where ${w.join(' and ')}`;
    const total = db.prepare(`select count(*) c ${from}`).get(...p).c;
    const items = db.prepare(`select o.id ormas_id,o.kode_ormas,o.nama_ormas,l.id laporan_id,coalesce(l.status,'belum') status,l.dikirim_at,l.updated_at,l.biaya_kegiatan ${from} order by case when l.status='dikirim' then 1 else 0 end, o.id limit ? offset ?`).all(...p, size, (page - 1) * size);
    res.json({ tahun: th, ringkasan: { tahun: th, ...summary(th) }, items, total, page, pageSize: size });
  });
  app.get('/api/admin/laporan/ormas/:ormasId', auth('view_ormas'), (req, res) => {
    const o = db.prepare('select id,kode_ormas,nama_ormas from ormas where id=?').get(+req.params.ormasId);
    if (!o) return res.status(404).json({ error: 'Data ormas tidak ditemukan' });
    res.json({ ormas: o, items: db.prepare(`select ${LAP_COLS} from laporan_tahunan where ormas_id=? order by tahun desc`).all(o.id) });
  });
  app.get('/api/admin/laporan/:id/dokumentasi', auth('view_docs'), (req, res) => {
    const l = db.prepare('select * from laporan_tahunan where id=?').get(+req.params.id);
    if (!l?.dokumentasi_key) return res.status(404).json({ error: 'Dokumentasi tidak ditemukan' });
    sendPdf(req, res, { storage_key: l.dokumentasi_key, mime_type: 'application/pdf', nama_file: l.dokumentasi_nama || 'dokumentasi.pdf', pending: 0, ormas_id: l.ormas_id }, req.query.dl === '1', 'akses_dokumen_admin');
  });
  app.post('/api/admin/laporan/:id/revisi', auth('manage_ormas'), (req, res) => {
    const l = db.prepare('select l.*,o.kode_ormas,o.nama_ormas from laporan_tahunan l join ormas o on o.id=l.ormas_id where l.id=?').get(+req.params.id);
    if (!l) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    if (l.status !== 'dikirim') return res.status(400).json({ error: 'Revisi hanya dapat diminta untuk laporan yang sudah dikirim' });
    const catatan = String(req.body?.catatan || '').trim().slice(0, 900);
    if (!catatan) return res.status(400).json({ error: 'Tulis catatan revisi agar ormas tahu apa yang perlu diperbaiki' });
    db.prepare(`update laporan_tahunan set status='revisi',catatan_admin=?,updated_at=? where id=?`).run(catatan, now(), l.id);
    notifOrmas(l.ormas_id, { kategori: 'Required Action', jenis: 'revisi', judul: `Permintaan revisi Laporan Kegiatan Tahunan ${l.tahun}`, pesan: catatan });
    log(req, 'revisi_laporan', l.ormas_id, `Meminta revisi Laporan Kegiatan Tahunan ${l.tahun} ${l.kode_ormas}`);
    notifAdmin(req, `Meminta revisi Laporan Tahunan ${l.tahun} ${l.kode_ormas} (${l.nama_ormas})`, l.ormas_id);
    res.json({ ok: true });
  });

  // ===== Pengumuman SIDOMAS (tampil di dashboard semua ormas) =====
  const pengumumanOk = (b) => {
    const judul = String(b.judul || '').trim(), pesan = String(b.pesan || '').trim();
    if (judul.length < 3 || judul.length > 150) return { err: 'Judul pengumuman 3-150 karakter' };
    if (pesan.length < 3 || pesan.length > 1000) return { err: 'Isi pengumuman 3-1000 karakter' };
    return { judul, pesan, kategori: KATEGORI_NOTIF.includes(b.kategori) ? b.kategori : 'Information' };
  };
  app.get('/api/admin/pengumuman', auth('view_ormas'), (req, res) => res.json({ items: db.prepare('select id,kategori,judul,pesan,aktif,created_at from pengumuman order by id desc limit 100').all().map((x) => ({ ...x, aktif: !!x.aktif })) }));
  app.post('/api/admin/pengumuman', auth('manage_ormas'), (req, res) => {
    const r = pengumumanOk(req.body || {}); if (r.err) return res.status(400).json({ error: r.err });
    const id = db.prepare('insert into pengumuman(kategori,judul,pesan,aktif,created_by,created_at) values(?,?,?,1,?,?)').run(r.kategori, r.judul, r.pesan, req.admin.id, now()).lastInsertRowid;
    log(req, 'tambah_pengumuman', null, `Menambah pengumuman: ${r.judul}`);
    notifAdmin(req, `Menambah pengumuman SIDOMAS: ${r.judul}`);
    res.json({ id });
  });
  app.put('/api/admin/pengumuman/:id', auth('manage_ormas'), (req, res) => {
    const p = db.prepare('select * from pengumuman where id=?').get(+req.params.id);
    if (!p) return res.status(404).json({ error: 'Pengumuman tidak ditemukan' });
    db.prepare('update pengumuman set aktif=? where id=?').run(req.body?.aktif ? 1 : 0, p.id);
    log(req, 'ubah_pengumuman', null, `${req.body?.aktif ? 'Mengaktifkan' : 'Menonaktifkan'} pengumuman: ${p.judul}`);
    res.json({ ok: true });
  });
  app.delete('/api/admin/pengumuman/:id', auth('manage_ormas'), (req, res) => {
    const p = db.prepare('select * from pengumuman where id=?').get(+req.params.id);
    if (!p) return res.status(404).json({ error: 'Pengumuman tidak ditemukan' });
    db.prepare('delete from pengumuman where id=?').run(p.id);
    log(req, 'hapus_pengumuman', null, `Menghapus pengumuman: ${p.judul}`);
    res.json({ ok: true });
  });
}
