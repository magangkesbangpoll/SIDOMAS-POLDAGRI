import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
fs.mkdirSync(path.join(DATA_DIR, 'files'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'logos'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'pending'), { recursive: true }); // berkas perubahan dari ormas yang menunggu verifikasi admin

const keyFile = path.join(DATA_DIR, 'secret.key');
if (!process.env.SECRET && !fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(48).toString('hex'), { mode: 0o600 });
export const SECRET = process.env.SECRET || fs.readFileSync(keyFile, 'utf8').trim();

export const db = new Database(path.join(DATA_DIR, 'sidomas.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const PERMS = ['view_ormas', 'manage_ormas', 'view_docs', 'export', 'view_logs', 'manage_admins', 'manage_settings'];

// Hak akses per role. Menu di dashboard admin mengikuti daftar ini (menu tanpa izin otomatis tidak tampil).
//  - Super Admin                : semua menu dan hak akses
//  - Admin Digitalisasi Ormas: tanpa Manajemen Admin dan Pengaturan
//  - Kepala Bidang Poldagri  : tanpa Manajemen Admin dan Pengaturan
const TANPA_KELOLA = ['manage_admins', 'manage_settings'];
export const ROLE_PERMS = {
  'Admin Digitalisasi Ormas': PERMS.filter((p) => !TANPA_KELOLA.includes(p)),
  'Kepala Bidang Poldagri': PERMS.filter((p) => !TANPA_KELOLA.includes(p)),
  'Super Admin': [...PERMS],
};

db.exec(`
create table if not exists kategori(id integer primary key autoincrement, nama_kategori text unique not null, status_aktif integer not null default 1);
create table if not exists roles(id integer primary key autoincrement, nama_role text unique not null, permissions text not null);
create table if not exists admin(id integer primary key autoincrement, nama text not null, username text unique not null, email text unique not null, password_hash text not null, role_id integer not null references roles(id), status_akun text not null default 'aktif', must_change integer not null default 0, last_login text, created_at text not null, updated_at text not null);
create table if not exists ormas(id integer primary key autoincrement, kode_ormas text unique not null, nama_ormas text not null, logo_key text, kategori_id integer not null references kategori(id), nama_ketua text, nomor_whatsapp_ketua text, alamat text, email_ormas text, nomor_sk text, status_dokumen text not null default 'Belum Lengkap', status_operasional text not null default 'Aktif', status_publikasi text not null default 'Disembunyikan', catatan_verifikasi text, created_at text not null, updated_at text not null, created_by integer references admin(id), updated_by integer references admin(id));
create table if not exists dokumen_ormas(id integer primary key autoincrement, ormas_id integer not null references ormas(id) on delete cascade, nama_file text not null, storage_key text unique not null, mime_type text not null, ukuran_file integer not null, uploaded_at text not null, uploaded_by integer references admin(id), status_dokumen text, klasifikasi_akses text not null default 'publik');
create table if not exists log_aktivitas(id integer primary key autoincrement, admin_id integer, nama_pengguna text, role text, jenis_aktivitas text not null, ormas_id integer, ringkasan text, waktu_aktivitas text not null, hasil text not null default 'berhasil');
create table if not exists settings(key text primary key, value text not null);
create table if not exists reset_tokens(id integer primary key autoincrement, admin_id integer not null references admin(id) on delete cascade, token_hash text unique not null, expires_at text not null, used integer not null default 0);
create table if not exists akun_ormas(ormas_id integer primary key references ormas(id) on delete cascade, username text unique not null, password_hash text not null, must_change integer not null default 1, last_login text, created_at text not null, updated_at text not null);
create table if not exists reset_tokens_ormas(id integer primary key autoincrement, ormas_id integer not null references ormas(id) on delete cascade, token_hash text unique not null, expires_at text not null, used integer not null default 0);
-- Perubahan data dari portal ormas yang MENUNGGU verifikasi admin (data katalog tetap memakai tabel ormas sampai diverifikasi)
create table if not exists perubahan_ormas(ormas_id integer primary key references ormas(id) on delete cascade, data text not null, logo_key text, logo_nama text, remove_logo integer not null default 0, status_sebelumnya text, created_at text not null, updated_at text not null);
-- Pendaftaran ormas baru dari halaman publik (menunggu tindak lanjut admin; belum masuk tabel ormas/katalog/Google Drive)
create table if not exists pendaftaran_ormas(id integer primary key autoincrement, nama_ormas text not null, kategori_nama text not null, data text not null, logo_key text, logo_nama text, status text not null default 'tindaklanjuti', catatan text, ormas_id integer, created_at text not null, updated_at text);
create table if not exists pendaftaran_dokumen(id integer primary key autoincrement, pendaftaran_id integer not null references pendaftaran_ormas(id) on delete cascade, jenis text not null, nama_file text not null, storage_key text not null, ukuran integer);
-- Notifikasi untuk admin (lonceng). 'kunci' dipakai agar pengingat yang sama tidak dibuat dua kali.
create table if not exists notifikasi(id integer primary key autoincrement, jenis text not null, judul text not null, pesan text not null, ormas_id integer, kunci text unique, created_at text not null);
create table if not exists notifikasi_baca(notif_id integer not null references notifikasi(id) on delete cascade, admin_id integer not null references admin(id) on delete cascade, primary key(notif_id, admin_id));
-- Langganan notifikasi HP (Web Push) per perangkat admin
create table if not exists push_langganan(id integer primary key autoincrement, admin_id integer not null references admin(id) on delete cascade, endpoint text unique not null, p256dh text not null, auth text not null, created_at text not null);
create index if not exists idx_ormas_nama on ormas(nama_ormas);
create index if not exists idx_ormas_kat on ormas(kategori_id);
create index if not exists idx_ormas_status on ormas(status_dokumen, status_operasional, status_publikasi);
create index if not exists idx_dok_ormas on dokumen_ormas(ormas_id);
create index if not exists idx_log_waktu on log_aktivitas(waktu_aktivitas);
`);

// Migrasi untuk database yang dibuat sebelum kolom kontak ditambahkan
const cols = db.prepare('pragma table_info(ormas)').all().map((c) => c.name);
for (const c of ['nomor_whatsapp_ketua', 'alamat', 'email_ormas', 'sekretaris', 'bendahara', 'kemantren', 'bentuk', 'bidang_kegiatan', 'legal_jenis', 'legal_tahun', 'legal_berlaku_sd', 'skto_nomor', 'skto_tahun', 'skto_berlaku_sd', 'validasi', 'catatan_penolakan', 'link_dokumentasi', 'link_instagram', 'link_youtube', 'link_tiktok', 'cp_bagian'])
  if (!cols.includes(c)) db.exec(`alter table ormas add column ${c} text`);
// Jumlah anggota (hanya angka, tanpa nama)
for (const c of ['anggota_perempuan', 'anggota_lansia', 'anggota_disabilitas', 'anggota_total'])
  if (!cols.includes(c)) db.exec(`alter table ormas add column ${c} integer`);
if (!db.prepare('pragma table_info(dokumen_ormas)').all().some((c) => c.name === 'jenis_dokumen')) db.exec('alter table dokumen_ormas add column jenis_dokumen text');
// pending=1: PDF kiriman ormas yang menunggu verifikasi (belum tampil di katalog, belum masuk Google Drive)
if (!db.prepare('pragma table_info(dokumen_ormas)').all().some((c) => c.name === 'pending')) db.exec('alter table dokumen_ormas add column pending integer not null default 0');

// ---- Revisi Batch 4 (Legal Standing) dan Batch 5 (kontak) ----
// legal_status: 'ya' (memiliki Legal Standing), 'tidak' (belum memiliki), '' (belum ditentukan).
// telepon_ormas: nomor kontak resmi organisasi, terpisah dari nomor pribadi ketua (kolom nomor_whatsapp_ketua tetap dipakai untuk ketua).
for (const c of ['legal_status', 'telepon_ormas'])
  if (!cols.includes(c)) db.exec(`alter table ormas add column ${c} text`);
// Data lama yang sudah punya isian Legal Standing otomatis dianggap "ya"; sisanya dibiarkan belum ditentukan agar admin/ormas yang mengonfirmasi.
db.exec(`update ormas set legal_status='ya' where coalesce(legal_status,'')='' and (coalesce(legal_jenis,'')!='' or coalesce(nomor_sk,'')!='' or coalesce(legal_tahun,'')!='' or coalesce(legal_berlaku_sd,'')!='')`);

// ---- Revisi Batch 6 (dashboard ormas): notifikasi untuk ormas ----
// kategori: Information | Warning | Required Action. 'kunci' mencegah pengingat yang sama dibuat dua kali untuk satu ormas.
db.exec(`
create table if not exists notifikasi_ormas(id integer primary key autoincrement, ormas_id integer not null references ormas(id) on delete cascade, kategori text not null default 'Information', jenis text not null, judul text not null, pesan text not null, kunci text, dibaca integer not null default 0, created_at text not null, unique(ormas_id, kunci));
create index if not exists idx_notif_ormas on notifikasi_ormas(ormas_id, dibaca);
-- Pengumuman SIDOMAS dari admin untuk semua ormas
create table if not exists pengumuman(id integer primary key autoincrement, kategori text not null default 'Information', judul text not null, pesan text not null, aktif integer not null default 1, created_by integer references admin(id) on delete set null, created_at text not null);
`);

// ---- Revisi Batch 7 (laporan kegiatan tahunan) ----
// Satu laporan per ormas per tahun. Laporan yang sudah dikirim tetap tersimpan sebagai arsip.
// status: 'draft' (masih disusun) | 'dikirim' (sudah dikirim ke admin).
db.exec(`
create table if not exists laporan_tahunan(
  id integer primary key autoincrement,
  ormas_id integer not null references ormas(id) on delete cascade,
  tahun integer not null,
  rencana_program text,
  pelaksanaan_kegiatan text,
  biaya_kegiatan integer,
  sumber_dana text,
  dokumentasi_link text,
  dokumentasi_key text,
  dokumentasi_nama text,
  penutup text,
  status text not null default 'draft',
  catatan_admin text,
  dikirim_at text,
  created_at text not null,
  updated_at text not null,
  unique(ormas_id, tahun)
);
create index if not exists idx_laporan_tahun on laporan_tahunan(tahun, status);
`);

// "Validasi" sekarang berupa pilihan: Terdata / Terdaftar / Teregister. Isian teks lama yang tidak cocok dikosongkan.
db.exec(`update ormas set validasi=case lower(trim(validasi)) when 'terdata' then 'Terdata' when 'terdaftar' then 'Terdaftar' when 'teregister' then 'Teregister' else '' end where validasi is not null and validasi not in ('','Terdata','Terdaftar','Teregister')`);

// Urutan kategori yang bisa diatur admin
if (!db.prepare('pragma table_info(kategori)').all().some((c) => c.name === 'urutan')) {
  db.exec('alter table kategori add column urutan integer not null default 0');
  db.exec('update kategori set urutan=id');
}

export const getSetting = (k) => db.prepare('select value from settings where key=?').get(k)?.value;
export const setSetting = (k, v) => db.prepare('insert into settings(key,value) values(?,?) on conflict(key) do update set value=excluded.value').run(k, String(v));

const now = () => new Date().toISOString();

// ---- Seed awal (hanya saat database kosong) ----
const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(9).toString('base64url');
if (!db.prepare('select 1 from roles limit 1').get()) {
  db.transaction(() => {
    const defaults = { app_name: 'SIDOMAS', max_pdf_mb: 20, max_pdf_count: 10, session_minutes: 120, login_max_attempts: 10, catalog_public: 'true', recovery_from: 'no-reply@sidomas.local', ormas_seq: 0, roles_v2: 'done' };
    for (const [k, v] of Object.entries(defaults)) setSetting(k, v);
    const ins = db.prepare('insert into roles(nama_role,permissions) values(?,?)');
    for (const [nama, perms] of Object.entries(ROLE_PERMS)) ins.run(nama, JSON.stringify(perms));
    for (const k of ['Sosial dan Kemanusiaan', 'Keagamaan', 'Kepemudaan', 'Pendidikan', 'Kebudayaan', 'Lingkungan Hidup', 'Profesi', 'Hukum dan HAM', 'Ekonomi dan Kewirausahaan', 'Lainnya'])
      db.prepare('insert into kategori(nama_kategori,urutan) values(?,(select coalesce(max(urutan),0)+1 from kategori))').run(k);
    // Akun admin awal (role Super Admin, akses penuh): wajib ganti password saat login pertama.
    // Password awal diambil dari ADMIN_INITIAL_PASSWORD; jika kosong dibuat acak dan dicetak SEKALI di log server.
    const surveyorId = db.prepare(`select id from roles where nama_role='Super Admin'`).get().id;
    db.prepare('insert into admin(nama,username,email,password_hash,role_id,must_change,created_at,updated_at) values(?,?,?,?,?,1,?,?)')
      .run('Administrator Awal', 'admin', process.env.ADMIN_EMAIL || 'admin@sidomas.local', bcrypt.hashSync(initialPassword, 10), surveyorId, now(), now());
  })();
  if (!process.env.ADMIN_INITIAL_PASSWORD) {
    console.log(`\n=== AKUN ADMIN AWAL DIBUAT ===\nUsername : admin\nPassword : ${initialPassword}\nCatat sekarang, password ini tidak ditampilkan lagi. Wajib diganti saat login pertama.\n`);
  }
}

// Ganti nama role lama "Surveyor" menjadi "Super Admin" (hak akses TIDAK berubah)
if (!db.prepare("select 1 from roles where nama_role='Super Admin'").get()) db.prepare("update roles set nama_role='Super Admin' where nama_role='Surveyor'").run();

// ---- Migrasi role v2 (berjalan sekali pada database lama) ----
// - Menambah role Super Admin (akses penuh).
// - Mengurangi hak role Admin Digitalisasi Ormas: tanpa Manajemen Admin dan Pengaturan.
// - Agar tidak ada yang terkunci dari Manajemen Admin: jika setelah perubahan tidak ada akun aktif yang
//   memegang hak manage_admins, akun aktif tertua dijadikan Super Admin.
if (getSetting('roles_v2') !== 'done') {
  db.transaction(() => {
    const up = db.prepare('insert into roles(nama_role,permissions) values(?,?) on conflict(nama_role) do update set permissions=excluded.permissions');
    up.run('Admin Digitalisasi Ormas', JSON.stringify(ROLE_PERMS['Admin Digitalisasi Ormas']));
    up.run('Super Admin', JSON.stringify(ROLE_PERMS['Super Admin']));
    const aktif = db.prepare(`select a.id,r.permissions from admin a join roles r on r.id=a.role_id where a.status_akun='aktif' order by a.id`).all();
    if (aktif.length && !aktif.some((a) => JSON.parse(a.permissions).includes('manage_admins'))) {
      db.prepare(`update admin set role_id=(select id from roles where nama_role='Super Admin'),updated_at=? where id=?`).run(now(), aktif[0].id);
      console.log('Migrasi role: akun aktif tertua dijadikan Super Admin agar Manajemen Admin tetap bisa diakses.');
    }
    setSetting('roles_v2', 'done');
  })();
}

// ---- Batch 9: hapus Password Harian dan buka dokumen katalog tanpa kredensial ----
if (getSetting('batch9_pw_harian_dihapus') !== 'done') {
  db.transaction(() => {
    const up = db.prepare('insert into roles(nama_role,permissions) values(?,?) on conflict(nama_role) do update set permissions=excluded.permissions');
    for (const [nama, perms] of Object.entries(ROLE_PERMS)) up.run(nama, JSON.stringify(perms));
    db.exec(`update dokumen_ormas set klasifikasi_akses='publik'; drop table if exists kredensial_harian;`);
    setSetting('batch9_pw_harian_dihapus', 'done');
  })();
}

// ---- Batch 10: tracking pendaftaran, revisi berbatas waktu, dan riwayat status ----
const KOLOM_TRACKING = {
  tracking_id: "tracking_id text",
  akses_token_hash: "akses_token_hash text",
  tracking_gagal: "tracking_gagal integer not null default 0",
  tracking_locked_until: "tracking_locked_until text",
  revisi_count: "revisi_count integer not null default 0",
  tanggal_dikembalikan: "tanggal_dikembalikan text",
  batas_revisi: "batas_revisi text",
  izin_khusus: "izin_khusus integer not null default 0",
  pengingat_3hari: "pengingat_3hari integer not null default 0",
  otp_hash: "otp_hash text",
  otp_expired: "otp_expired text",
  otp_gagal: "otp_gagal integer not null default 0",
};
for (const [nama, ddl] of Object.entries(KOLOM_TRACKING)) {
  if (!db.prepare("select 1 from pragma_table_info('pendaftaran_ormas') where name=?").get(nama)) {
    db.exec(`alter table pendaftaran_ormas add column ${ddl}`);
  }
}
db.exec(`
  create unique index if not exists idx_pend_tracking on pendaftaran_ormas(tracking_id);
  create table if not exists pendaftaran_riwayat(
    id integer primary key autoincrement,
    pendaftaran_id integer not null references pendaftaran_ormas(id) on delete cascade,
    status text not null,
    label text not null,
    catatan text,
    oleh text not null default 'sistem',
    created_at text not null
  );
  create table if not exists pendaftaran_item(
    id integer primary key autoincrement,
    pendaftaran_id integer not null references pendaftaran_ormas(id) on delete cascade,
    item_key text not null,
    status text not null default 'pending',
    catatan text,
    updated_at text not null,
    unique(pendaftaran_id, item_key)
  );
  create index if not exists idx_pend_riwayat on pendaftaran_riwayat(pendaftaran_id, id);
  create index if not exists idx_pend_item on pendaftaran_item(pendaftaran_id, item_key);
`);
// Data lama yang sudah ada sebelum Batch 10 tetap mendapat Tracking ID (kode akses harus dibuat ulang admin).
const KUNCI_ITEM = ['nama_ormas', 'kategori_nama', 'bentuk', 'bidang_kegiatan', 'kemantren', 'nama_ketua', 'sekretaris', 'bendahara', 'nomor_whatsapp_ketua', 'telepon_ormas', 'email_ormas', 'alamat', 'legal_status', 'legal_jenis', 'nomor_sk', 'legal_tahun', 'legal_berlaku_sd', 'anggota_total', 'anggota_perempuan', 'anggota_lansia', 'anggota_disabilitas', 'link_dokumentasi', 'link_instagram', 'link_youtube', 'link_tiktok', 'cp_bagian'];
if (getSetting('batch10_tracking_revisi') !== 'done') {
  db.transaction(() => {
    const buat = () => `TRK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(9).toString('base64url').toUpperCase()}`;
    const lama = db.prepare('select * from pendaftaran_ormas').all();
    const set = db.prepare('update pendaftaran_ormas set tracking_id=? where id=?');
    const insItem = db.prepare("insert or ignore into pendaftaran_item(pendaftaran_id,item_key,status,catatan,updated_at) values(?,?,'pending',null,?)");
    const insRiwayat = db.prepare('insert into pendaftaran_riwayat(pendaftaran_id,status,label,catatan,oleh,created_at) values(?,?,?,?,?,?)');
    const t = new Date().toISOString();
    for (const r of lama) {
      if (!r.tracking_id) set.run(buat(), r.id);
      let d = {};
      try { d = JSON.parse(r.data || '{}'); } catch { /* data lama rusak tetap dibuat item kosong */ }
      const dok = db.prepare('select jenis from pendaftaran_dokumen where pendaftaran_id=?').all(r.id).map((x) => `dok:${x.jenis}`);
      const kunci = [...new Set(['nama_ormas', 'kategori_nama', ...KUNCI_ITEM.filter((k) => Object.prototype.hasOwnProperty.call(d, k)), ...dok])];
      if (r.logo_key) kunci.push('logo');
      for (const k of kunci) insItem.run(r.id, k, t);
      insRiwayat.run(r.id, r.status || 'tindaklanjuti', 'Data pendaftaran lama', null, 'sistem', r.created_at || t);
    }
    setSetting('batch10_tracking_revisi', 'done');
  })();
}

// Laporan tahunan: berkas ormas menunggu verifikasi di data/pending, baru dipindah ke Drive/local resmi setelah admin menyetujui.
if (!db.prepare("select 1 from pragma_table_info('laporan_tahunan') where name='dokumentasi_pending'").get()) {
  db.exec('alter table laporan_tahunan add column dokumentasi_pending integer not null default 0');
}

// (Pembersihan otomatis data "(DEMO SIMULASI)" sudah dihapus: tidak ada data yang dihapus saat server start.)
