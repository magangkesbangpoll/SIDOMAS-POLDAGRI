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

export const PERMS = ['view_ormas', 'manage_ormas', 'view_docs', 'view_credentials', 'manage_credentials', 'export', 'export_credentials', 'view_logs', 'manage_admins', 'manage_settings'];

db.exec(`
create table if not exists kategori(id integer primary key autoincrement, nama_kategori text unique not null, status_aktif integer not null default 1);
create table if not exists roles(id integer primary key autoincrement, nama_role text unique not null, permissions text not null);
create table if not exists admin(id integer primary key autoincrement, nama text not null, username text unique not null, email text unique not null, password_hash text not null, role_id integer not null references roles(id), status_akun text not null default 'aktif', must_change integer not null default 0, last_login text, created_at text not null, updated_at text not null);
create table if not exists ormas(id integer primary key autoincrement, kode_ormas text unique not null, nama_ormas text not null, logo_key text, kategori_id integer not null references kategori(id), nama_ketua text, nomor_whatsapp_ketua text, alamat text, email_ormas text, nomor_sk text, status_dokumen text not null default 'Belum Lengkap', status_operasional text not null default 'Aktif', status_publikasi text not null default 'Disembunyikan', catatan_verifikasi text, created_at text not null, updated_at text not null, created_by integer references admin(id), updated_by integer references admin(id));
create table if not exists dokumen_ormas(id integer primary key autoincrement, ormas_id integer not null references ormas(id) on delete cascade, nama_file text not null, storage_key text unique not null, mime_type text not null, ukuran_file integer not null, uploaded_at text not null, uploaded_by integer references admin(id), status_dokumen text, klasifikasi_akses text not null default 'kredensial');
create table if not exists kredensial_harian(id integer primary key autoincrement, ormas_id integer not null references ormas(id) on delete cascade, username text not null, password_hash text not null, password_enc text not null, tanggal_berlaku text not null, tanggal_kedaluwarsa text not null, created_at text not null, status text not null default 'aktif');
create table if not exists log_aktivitas(id integer primary key autoincrement, admin_id integer, nama_pengguna text, role text, jenis_aktivitas text not null, ormas_id integer, ringkasan text, waktu_aktivitas text not null, hasil text not null default 'berhasil');
create table if not exists settings(key text primary key, value text not null);
create table if not exists reset_tokens(id integer primary key autoincrement, admin_id integer not null references admin(id) on delete cascade, token_hash text unique not null, expires_at text not null, used integer not null default 0);
create table if not exists akun_ormas(ormas_id integer primary key references ormas(id) on delete cascade, username text unique not null, password_hash text not null, must_change integer not null default 1, last_login text, created_at text not null, updated_at text not null);
create table if not exists reset_tokens_ormas(id integer primary key autoincrement, ormas_id integer not null references ormas(id) on delete cascade, token_hash text unique not null, expires_at text not null, used integer not null default 0);
-- Perubahan data dari portal ormas yang MENUNGGU verifikasi admin (data katalog tetap memakai tabel ormas sampai diverifikasi)
create table if not exists perubahan_ormas(ormas_id integer primary key references ormas(id) on delete cascade, data text not null, logo_key text, logo_nama text, remove_logo integer not null default 0, status_sebelumnya text, created_at text not null, updated_at text not null);
create index if not exists idx_ormas_nama on ormas(nama_ormas);
create index if not exists idx_ormas_kat on ormas(kategori_id);
create index if not exists idx_ormas_status on ormas(status_dokumen, status_operasional, status_publikasi);
create index if not exists idx_dok_ormas on dokumen_ormas(ormas_id);
create index if not exists idx_kred on kredensial_harian(ormas_id, tanggal_berlaku, status);
create index if not exists idx_log_waktu on log_aktivitas(waktu_aktivitas);
`);

// Migrasi untuk database yang dibuat sebelum kolom kontak ditambahkan
const cols = db.prepare('pragma table_info(ormas)').all().map((c) => c.name);
for (const c of ['nomor_whatsapp_ketua', 'alamat', 'email_ormas', 'sekretaris', 'bendahara', 'kemantren', 'bentuk', 'bidang_kegiatan', 'legal_jenis', 'legal_tahun', 'legal_berlaku_sd', 'skto_nomor', 'skto_tahun', 'skto_berlaku_sd', 'validasi', 'catatan_penolakan'])
  if (!cols.includes(c)) db.exec(`alter table ormas add column ${c} text`);
if (!db.prepare('pragma table_info(dokumen_ormas)').all().some((c) => c.name === 'jenis_dokumen')) db.exec('alter table dokumen_ormas add column jenis_dokumen text');
// pending=1: PDF kiriman ormas yang menunggu verifikasi (belum tampil di katalog, belum masuk Google Drive)
if (!db.prepare('pragma table_info(dokumen_ormas)').all().some((c) => c.name === 'pending')) db.exec('alter table dokumen_ormas add column pending integer not null default 0');

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
    const defaults = { app_name: 'SIDOMAS', max_pdf_mb: 20, max_pdf_count: 10, session_minutes: 120, login_max_attempts: 10, catalog_public: 'true', recovery_from: 'no-reply@sidomas.local', ormas_seq: 0 };
    for (const [k, v] of Object.entries(defaults)) setSetting(k, v);
    const ins = db.prepare('insert into roles(nama_role,permissions) values(?,?)');
    ins.run('Admin Digitalisasi Ormas', JSON.stringify(PERMS));
    ins.run('Kepala Bidang Poldagri', JSON.stringify(PERMS.filter((p) => !['manage_admins', 'manage_settings', 'export_credentials'].includes(p))));
    for (const k of ['Sosial dan Kemanusiaan', 'Keagamaan', 'Kepemudaan', 'Pendidikan', 'Kebudayaan', 'Lingkungan Hidup', 'Profesi', 'Hukum dan HAM', 'Ekonomi dan Kewirausahaan', 'Lainnya'])
      db.prepare('insert into kategori(nama_kategori,urutan) values(?,(select coalesce(max(urutan),0)+1 from kategori))').run(k);
    // Akun admin awal: wajib ganti password saat login pertama.
    // Password awal diambil dari ADMIN_INITIAL_PASSWORD; jika kosong dibuat acak dan dicetak SEKALI di log server.
    db.prepare('insert into admin(nama,username,email,password_hash,role_id,must_change,created_at,updated_at) values(?,?,?,?,?,1,?,?)')
      .run('Administrator Awal', 'admin', process.env.ADMIN_EMAIL || 'admin@sidomas.local', bcrypt.hashSync(initialPassword, 10), 1, now(), now());
  })();
  if (!process.env.ADMIN_INITIAL_PASSWORD) {
    console.log(`\n=== AKUN ADMIN AWAL DIBUAT ===\nUsername : admin\nPassword : ${initialPassword}\nCatat sekarang, password ini tidak ditampilkan lagi. Wajib diganti saat login pertama.\n`);
  }
}

// Pembersihan data contoh dari versi lama: hapus ormas bertanda "(DEMO SIMULASI)".
// Jika setelah itu tidak ada ormas tersisa, penomoran ID dimulai lagi dari Ormas-001.
{
  const lama = db.prepare("select id from ormas where nama_ormas like '%(DEMO SIMULASI)%'").all();
  if (lama.length) {
    db.transaction(() => {
      for (const o of lama) db.prepare('delete from ormas where id=?').run(o.id);
      if (!db.prepare('select 1 from ormas limit 1').get()) setSetting('ormas_seq', 0);
    })();
    console.log(`Data contoh lama dihapus: ${lama.length} ormas.`);
  }
}
