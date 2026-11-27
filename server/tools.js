// Alat bantu admin lewat terminal. Jalankan dari folder utama proyek (yang berisi package.json).
//   npm run admins                              -> daftar akun admin
//   npm run reset-admin -- admin PasswordBaru1  -> atur ulang password admin
//   npm run reset-admin -- admin                -> password baru dibuat acak
//   npm run test-email -- emailanda@gmail.com   -> uji pengiriman email (SMTP)
//   npm run check-reset -- email@contoh.id      -> cek kenapa tautan reset tidak terkirim ke email itu
//   npm run set-email -- admin email@contoh.id  -> ubah email akun admin
//   npm run backup-now                          -> backup database ke Google Drive sekarang
//   npm run rapikan-drive                       -> pindahkan semua PDF dan logo ke folder ormas masing-masing di Drive
//   npm run bersihkan-sisa-drive -- --confirm   -> buang file lepas di folder induk yang tidak tercatat di database
//   npm run laporan-drive                       -> lihat file lepas di induk + daftar folder ormas dan jumlah isinya
//   npm run bersihkan-folder-yatim -- --confirm -> buang folder ormas yang kodenya tidak ada di database (termasuk folder uji)
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { db } from './db.js';
import { backupDb } from './backup.js';
import { driveOn, driveOrganize, driveCleanRoot, driveLaporan, driveCleanFoldersYatim } from './drive.js';

const [cmd, ...args] = process.argv.slice(2);
const stop = (msg) => { console.error(`\nGAGAL: ${msg}\n`); process.exit(1); };
const ALPHA = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
const random = (n) => Array.from({ length: n }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join('');

function listAdmins() {
  return db.prepare('select a.username,a.nama,a.email,a.status_akun,a.last_login,r.nama_role from admin a join roles r on r.id=a.role_id order by a.id').all();
}

if (cmd === 'admins') {
  console.log('\nDaftar akun admin:');
  console.table(listAdmins());
  console.log('Lupa password? Jalankan: npm run reset-admin -- NAMA_USERNAME\n');

} else if (cmd === 'reset-admin') {
  const [username, given] = args;
  if (!username) stop('Tulis username-nya. Contoh: npm run reset-admin -- admin');
  const a = db.prepare('select id,username from admin where lower(username)=lower(?)').get(username);
  if (!a) { console.table(listAdmins()); stop(`Username "${username}" tidak ditemukan. Pilih salah satu username pada tabel di atas.`); }
  const pass = given || random(12);
  if (pass.length < 8 || pass === '123') stop('Password minimal 8 karakter dan tidak boleh "123".');
  db.prepare("update admin set password_hash=?,status_akun='aktif',must_change=1,updated_at=? where id=?").run(bcrypt.hashSync(pass, 10), new Date().toISOString(), a.id);
  console.log(`\nBERHASIL. Akun "${a.username}" sudah diaktifkan dan password-nya diatur ulang.`);
  console.log(`  Username : ${a.username}`);
  console.log(`  Password : ${pass}`);
  console.log('Login memakai data di atas. Sistem akan meminta Anda membuat password baru.\n');

} else if (cmd === 'set-email') {
  const [username, email] = args;
  if (!username || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) stop('Format: npm run set-email -- USERNAME email@contoh.id');
  const a = db.prepare('select id,username from admin where lower(username)=lower(?)').get(username);
  if (!a) { console.table(listAdmins()); stop(`Username "${username}" tidak ditemukan.`); }
  try { db.prepare('update admin set email=?,updated_at=? where id=?').run(email.trim().toLowerCase(), new Date().toISOString(), a.id); }
  catch { stop('Email itu sudah dipakai akun admin lain.'); }
  console.log(`\nBERHASIL. Email akun "${a.username}" sekarang: ${email.trim().toLowerCase()}\n`);

} else if (cmd === 'check-reset') {
  const email = String(args[0] || '').trim().toLowerCase();
  if (!email) stop('Tulis email yang Anda ketik di halaman Lupa Password. Contoh: npm run check-reset -- nama@students.amikom.ac.id');
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  console.log('\n=== 1. Pengaturan pengirim email (.env) ===');
  console.log(`SMTP_HOST : ${SMTP_HOST || '(KOSONG)'}`);
  console.log(`SMTP_USER : ${SMTP_USER || '(KOSONG)'}`);
  console.log(`SMTP_PASS : ${SMTP_PASS ? `terisi (${SMTP_PASS.length} karakter${/\s/.test(SMTP_PASS) ? ', MENGANDUNG SPASI: hapus spasinya' : ''})` : '(KOSONG)'}`);
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) console.log('>> MASALAH: pengirim email belum diatur. Kolom "Email pengirim pemulihan password" di halaman Pengaturan BUKAN pengganti ini. Isi SMTP_* di file .env lalu jalankan: npm run test-email -- emailanda@gmail.com');
  else console.log('>> Pengaturan terisi. Uji sebenarnya dengan: npm run test-email -- ' + email);
  console.log('\n=== 2. Apakah email itu terdaftar? ===');
  const admin = db.prepare("select username,status_akun from admin where lower(email)=?").get(email);
  const ormas = db.prepare('select o.kode_ormas,o.nama_ormas,a.username from ormas o join akun_ormas a on a.ormas_id=o.id where lower(o.email_ormas)=?').all(email);
  if (admin) console.log(`Admin   : TERDAFTAR (username ${admin.username}, status ${admin.status_akun})${admin.status_akun !== 'aktif' ? ' >> akun nonaktif, tautan tidak dikirim' : ''}`);
  else console.log('Admin   : TIDAK ada akun admin dengan email ini, jadi tautan TIDAK dikirim.');
  if (ormas.length) ormas.forEach((o) => console.log(`Ormas   : TERDAFTAR (${o.kode_ormas} ${o.nama_ormas}, username ${o.username})`));
  else console.log('Ormas   : tidak ada ormas dengan email ini (atau akun portalnya belum dibuat).');
  if (!admin && !ormas.length) { console.log('\nEmail admin yang sebenarnya tersimpan:'); console.table(listAdmins().map(({ username, email: e, status_akun }) => ({ username, email: e, status_akun }))); console.log('Samakan, atau ubah dengan: npm run set-email -- USERNAME email@contoh.id'); }
  console.log('');

} else if (cmd === 'backup-now') {
  try {
    const r = await backupDb(true);
    if (r.skipped) stop(r.skipped);
    console.log(`\nBERHASIL. Backup database dikirim ke folder BACKUP-DATABASE di Google Drive (id file ${r.id}).\n`);
  } catch (e) { stop(e.message); }

} else if (cmd === 'rapikan-drive') {
  if (!driveOn()) stop('GDRIVE_URL dan/atau GDRIVE_SECRET belum diisi di file .env.');
  const semua = db.prepare('select id,kode_ormas,nama_ormas,logo_key from ormas order by id').all();
  let dipindah = 0;
  console.log(`\nMerapikan ${semua.length} ormas ...`);
  for (const o of semua) {
    const ids = [...db.prepare('select storage_key from dokumen_ormas where ormas_id=?').all(o.id).map((r) => r.storage_key), ...db.prepare('select dokumentasi_key k from laporan_tahunan where ormas_id=?').all(o.id).map((r) => r.k), o.logo_key].filter((k) => String(k || '').startsWith('gd:')).map((k) => k.slice(3));
    if (!ids.length) continue;
    try { const r = await driveOrganize(o.kode_ormas, o.nama_ormas, ids); dipindah += r.moved || 0; console.log(`  ${o.kode_ormas}: ${ids.length} file, ${r.moved || 0} dipindah`); }
    catch (e) { console.log(`  ${o.kode_ormas}: GAGAL (${e.message})`); }
  }
  console.log(`\nSELESAI. ${dipindah} file dipindah ke folder ormas masing-masing.\n`);

} else if (cmd === 'bersihkan-sisa-drive') {
  if (!driveOn()) stop('GDRIVE_URL dan/atau GDRIVE_SECRET belum diisi di file .env.');
  if (!args.includes('--confirm')) stop('Perintah ini membuang file ke Sampah Drive. Tambahkan --confirm setelah perintah untuk melanjutkan.');
  const kunci = [
    ...db.prepare("select storage_key k from dokumen_ormas where storage_key like 'gd:%'").all().map((r) => r.k),
    ...db.prepare("select dokumentasi_key k from laporan_tahunan where dokumentasi_key like 'gd:%'").all().map((r) => r.k),
    ...db.prepare("select logo_key k from ormas where logo_key like 'gd:%'").all().map((r) => r.k),
  ].filter(Boolean).map((k) => k.slice(3));
  const whitelist = [...new Set(kunci)];
  console.log(`\n${whitelist.length} file masih dipakai database (tidak akan disentuh).`);
  try {
    const r = await driveCleanRoot(whitelist);
    console.log(`SELESAI. ${r.dihapus || 0} file lepas di folder induk dipindah ke Sampah Drive.`);
    (r.nama || []).slice(0, 30).forEach((n) => console.log(`  - ${n}`));
    if ((r.dihapus || 0) > 30) console.log(`  ... dan ${r.dihapus - 30} file lainnya`);
  } catch (e) { stop(e.message); }

} else if (cmd === 'laporan-drive') {
  if (!driveOn()) stop('GDRIVE_URL dan/atau GDRIVE_SECRET belum diisi di file .env.');
  try {
    const r = await driveLaporan();
    (r.roots || []).forEach((root) => {
      console.log(`\n${root.label} (${root.id})`);
      console.log(`  File lepas di induk: ${root.lepas}`);
      (root.folders || []).forEach((f) => console.log(`  - ${f.nama} (${f.jumlah} file)`));
    });
    console.log('');
  } catch (e) { stop(e.message); }

} else if (cmd === 'bersihkan-folder-yatim') {
  if (!driveOn()) stop('GDRIVE_URL dan/atau GDRIVE_SECRET belum diisi di file .env.');
  if (!args.includes('--confirm')) stop('Perintah ini membuang folder ke Sampah Drive. Tambahkan --confirm setelah perintah untuk melanjutkan.');
  const kodes = db.prepare('select kode_ormas from ormas').all().map((r) => r.kode_ormas).filter(Boolean);
  console.log(`\n${kodes.length} kode ormas aktif tidak akan disentuh.`);
  try {
    const r = await driveCleanFoldersYatim(kodes);
    console.log(`SELESAI. ${r.dihapus || 0} folder yatim/uji dipindah ke Sampah Drive.`);
    (r.nama || []).slice(0, 30).forEach((n) => console.log(`  - ${n}`));
    if ((r.dihapus || 0) > 30) console.log(`  ... dan ${r.dihapus - 30} folder lainnya`);
  } catch (e) { stop(e.message); }

} else if (cmd === 'test-email') {
  const to = args[0];
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) stop('Tulis email tujuan. Contoh: npm run test-email -- emailanda@gmail.com');
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) stop('SMTP_HOST kosong. File .env belum ada atau belum diisi. Pastikan file bernama persis ".env" (bukan ".env.txt") dan berada di folder utama proyek, sejajar dengan package.json.');
  if (SMTP_USER && !SMTP_PASS) stop('SMTP_USER terisi tetapi SMTP_PASS kosong.');
  const from = process.env.SMTP_FROM || (SMTP_USER ? `"SIDOMAS" <${SMTP_USER}>` : 'no-reply@sidomas.local');
  const t = nodemailer.createTransport({ host: SMTP_HOST, port: +SMTP_PORT || 587, secure: SMTP_SECURE === 'true', auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined, connectionTimeout: 15000, greetingTimeout: 15000 });
  console.log(`\nMenghubungi ${SMTP_HOST}:${+SMTP_PORT || 587} sebagai ${SMTP_USER || '(tanpa login)'} ...`);
  try {
    await t.verify();
    console.log('Login ke server email BERHASIL. Mengirim email uji ...');
    await t.sendMail({ from, to, subject: 'Tes email SIDOMAS', text: 'Jika Anda menerima email ini, pengaturan SMTP SIDOMAS sudah benar.' });
    console.log(`\nBERHASIL. Email uji dikirim ke ${to}. Periksa kotak masuk dan folder spam.\n`);
  } catch (e) {
    const hint = e.code === 'EAUTH' ? 'Username atau sandi salah. Untuk Gmail wajib memakai "Sandi aplikasi" (App Password) 16 karakter, tulis TANPA spasi, bukan password Gmail biasa.'
      : ['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNREFUSED'].includes(e.code) ? 'Port SMTP diblokir jaringan/firewall/antivirus (bukan salah password). Coba jaringan lain/hotspot. Bila tetap gagal, pakai relay yang membuka port 443, misalnya Brevo: SMTP_HOST=smtp-relay.brevo.com, SMTP_PORT=443, SMTP_SECURE=true, SMTP_USER/SMTP_PASS dari akun Brevo.'
      : 'Periksa kembali isi file .env.';
    stop(`${e.message}\n${hint}`);
  }

} else {
  console.log(
    [
      '',
      'Perintah yang tersedia:',
      '  npm run admins',
      '  npm run reset-admin -- USERNAME [PASSWORDBARU]',
      '  npm run test-email -- EMAIL_TUJUAN',
      '  npm run check-reset -- EMAIL',
      '  npm run set-email -- USERNAME EMAIL',
      '  npm run backup-now',
      '  npm run rapikan-drive',
      '',
    ].join('\n'),
  );
}
