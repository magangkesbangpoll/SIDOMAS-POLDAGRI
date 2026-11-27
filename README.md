# SIDOMAS: Sistem Digitalisasi Data Organisasi Kemasyarakatan

Aplikasi web untuk mengelola data dan dokumen organisasi kemasyarakatan (ormas) Bidang Poldagri.
Stack: React + TypeScript + Tailwind CSS (client), Node.js + Express + SQLite (server).
Sistem ini adalah sistem administrasi dan dokumentasi internal dengan katalog publik, bukan situs resmi Pemerintah Kota Yogyakarta.

## Fitur
- **Katalog publik**: cari, filter, urutkan. Halaman ormas menampilkan logo, struktur pengurus, email, lokasi kantor (dengan peta mini), dan **Company Profile**. Company Profile tampil dari hasil upload pendaftaran ormas, perubahan di portal ormas, maupun input admin SIDOMAS — setelah statusnya `pending=0`/disetujui. **PDF lain tidak ditampilkan di katalog.**
- **Dokumen katalog**: hanya **Company Profile** yang bisa dibaca/unduh publik tanpa username/password (Batch 10). PDF SK Pengurusan, domisili, program kerja, badan hukum, SKTO, AD/ART, dan laporan tetap **tersimpan di Google Drive** untuk verifikasi/admin, tetapi tidak muncul di katalog dan tidak bisa diakses lewat `/api/public/files/:id`. Data pendaftaran, berkas `pending`/revisi, laporan tahunan, dan catatan admin juga **tidak pernah** tampil di katalog.
- **Tracking pendaftaran (Batch 10)**: tiap pendaftaran mendapat Tracking ID unik. Menu ada di **halaman publik** (bukan di portal ormas yang sudah login). Akses ke halaman `/tracking` memakai **Kode OTP 6 digit yang dikirim ke email atau WhatsApp ormas** (disimpan sebagai hash, berlaku 10 menit).
- **Persetujuan pendaftaran**: di **Periksa item**, bila semua item berstatus **Terverifikasi (terkunci)**, tombol berubah menjadi **Setujui pendaftaran ormas**. Saat disetujui, semua PDF & logo diunggah ke folder Drive ormas dengan progress bar, data ormas berstatus `Publik` tampil di katalog (Company Profile terbuka; PDF lain tetap di Drive untuk admin), dan akun portal dibuat. Halaman menampilkan status, progres, riwayat, catatan admin, dan seluruh item dengan indikator terverifikasi / perlu revisi / belum diperiksa. Ormas hanya bisa mengubah item yang dikembalikan admin, maksimal **30 hari kalender** sejak status **Dikembalikan**. Lewat batas menjadi **Hangus/Kedaluwarsa**; admin dapat memberi izin khusus pengajuan ulang dan mengirim ulang OTP bila email hilang.
- **5 dokumen wajib**: SK Pengurusan, Surat Keterangan Domisili, Program Kerja, Salinan Badan Hukum, SKTO. Wajib diunggah untuk verifikasi administrasi dan tetap tersimpan di Drive, tetapi **tidak dipublikasikan di katalog**.
- **Portal ormas** (`/ormas-login`): tiap ormas punya akun tetap untuk memperbarui data dan dokumennya sendiri.
- **Dashboard admin**: statistik, data ormas, monitoring laporan tahunan (6 kategori), manajemen admin (tambah, ubah, nonaktifkan, hapus), ekspor CSV, log aktivitas, pengaturan.
- **Verifikasi perubahan**: perubahan data atau PDF dari portal ormas ditahan dulu. Katalog publik dan Google Drive tetap memakai data lama sampai admin menekan **Verifikasi** (atau **Tolak**) di Detail Ormas.
- **Status validasi** (dropdown Terdata / Terdaftar / Teregister) dan **jumlah anggota** (total, perempuan, lansia, disabilitas; angka saja). Jumlah anggota tampil di katalog satu baris dengan ketua, sekretaris, dan bendahara.
- **Dokumentasi kegiatan** (opsional): unggah PDF atau tempel tautan (mis. Google Drive), plus tautan Instagram ormas.
- **Peringatan masa berlaku SKTO / Legal Standing**: label "Segera berakhir" / "Sudah kedaluwarsa" di Data Ormas, menu **Dokumen Kedaluwarsa** (dihitung dari tanggal Berlaku s/d), dan pengingat otomatis.
- **Notifikasi admin**: lonceng dengan titik merah, hilang setelah klik "Sudah dibaca". Notifikasi HP (Web Push): "Admin (nama) Telah Memperbarui, CEK SELENGKAPNYA!" dan "Ormas (nama) Telah Melakukan Perubahan, CEK SELENGKAPNYA DAN KONFIRMASI PERUBAHAN". Aktifkan per perangkat di menu Notifikasi (butuh HTTPS atau localhost).
- **Pengingat laporan tahunan (Batch 8)**: aktif hanya **1–31 Desember** (sebelum pergantian tahun), berisi tahun laporan, status, persentase kelengkapan, dan tautan `/portal/laporan`. Ormas yang sudah mengirim berubah menjadi **Menunggu Verifikasi**; yang sudah **Selesai** tidak diingatkan lagi. Berkas laporan yang diunggah ormas tetap di `data/pending` dan **baru masuk Drive saat admin menekan "Tandai selesai"**, dengan nama `Laporan Kegiatan Tahunan <tahun> - <nama file>`. Admin memantau: sudah mengirim, belum mengirim, belum lengkap, menunggu verifikasi, dikembalikan, dan selesai.
- **Penyimpanan Google Drive**: satu folder induk `DATABASE SIDOMAS POLDAGRI (DEMO)`. Tiap ormas otomatis punya **satu** subfolder `Ormas-XXX - Nama Ormas` berisi PDF **dan** logo/foto profil ormas itu saja, plus backup database harian otomatis. Saat admin menyetujui pendaftaran, memverifikasi perubahan, menandai laporan selesai, atau menyimpan data ormas, muncul **progress bar bertahap** (bukan spinner biasa) yang hilang setelah server merespons.

## Role dan hak akses
- **Super Admin**: semua menu dan hak akses, termasuk Manajemen Admin dan Pengaturan.
- **Admin Digitalisasi Ormas**: Dashboard, Data Ormas (lihat, ubah, verifikasi), Laporan Tahunan, Dokumen Kedaluwarsa, Notifikasi, Ekspor Data (CSV ormas), dan Log Aktivitas. Tanpa Manajemen Admin dan Pengaturan.
- **Kepala Bidang Poldagri**: hak akses sama dengan Admin Digitalisasi Ormas.
- Menu dan tombol mengikuti hak akses role; server tetap memeriksa izin pada setiap permintaan. Akun admin awal (`admin`) berperan Super Admin. Pada database lama, migrasi berjalan sekali saat server start dan memastikan minimal satu akun aktif tetap berperan Super Admin.

## Menjalankan di komputer sendiri
Prasyarat: Node.js 18 atau lebih baru.
1. `npm install`, lalu `cd client`, `npm install`, `cd ..` (atau `npm run setup`).
2. Salin `.env.example` menjadi `.env`, lalu isi seperlunya.
3. `npm run dev`, lalu buka http://localhost:5173
4. Saat database pertama kali dibuat, password admin awal dicetak sekali di terminal (atau diambil dari `ADMIN_INITIAL_PASSWORD`). Username: `admin`. Sistem meminta ganti password dan mengisi email saat login pertama.

## Email — wajib untuk OTP tracking
Kode OTP pelacakan pendaftaran **hanya dikirim lewat email**. Tanpa konfigurasi SMTP, OTP tidak sampai ke ormas (di server lokal, OTP hanya tercetak di terminal untuk uji coba).

1. Untuk Gmail: aktifkan **2-Step Verification**, lalu buka https://myaccount.google.com/apppasswords dan buat **App password** 16 karakter (tanpa spasi). Ini bukan password login Gmail biasa.
2. Buka file **`.env`** di folder `SIDOMAS-POLDAGRI-main` (sejajar dengan `package.json`), bukan `.env.example`. Isi blok ini:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=email-gmail-yang-membuat-app-password@gmail.com
   SMTP_PASS=16karakterapppasswordtanpas
   SMTP_FROM="SIDOMAS" <email-gmail-yang-sama@gmail.com>
   ```
   `SMTP_USER` **harus sama** dengan akun yang membuat App password. `SMTP_FROM` disarankan sama dengan `SMTP_USER` agar tidak ditolak Gmail.
3. Uji: `npm run test-email -- emailanda@gmail.com`. Periksa juga folder Spam. Bila gagal dengan `Connection timeout`, itu **bukan salah password**: port SMTP 465/587 diblokir jaringan/firewall/antivirus (di jaringan ini Gmail 25/465/587/443 dan Brevo/Mailjet 587 timeout). Coba jaringan lain/hotspot.
   - Jika harus memakai jaringan yang sama, pakai relay yang bisa lewat port 443, misalnya **Brevo** (gratis): `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=443`, `SMTP_SECURE=true`, `SMTP_USER`/`SMTP_PASS` dari akun Brevo, dan `SMTP_FROM` memakai email pengirim yang sudah diverifikasi di Brevo.
4. **Restart server** setelah mengubah `.env` (`Ctrl+C`, lalu `npm run dev` atau `npm start`). Nilai `.env` dibaca sekali saat server start.
5. Alur ormas: buka `/tracking` → isi Tracking ID → **Kirim OTP ke email** → masukkan 6 digit → **Verifikasi & Lacak**. Admin juga punya tombol **Kirim OTP** di antrean pendaftaran.

## Google Drive
1. Buka https://script.google.com dengan akun pemilik folder Drive, buat proyek baru, tempel isi `docs/google-apps-script.gs`, lalu ganti `SECRET` dengan kunci acak panjang. Di baris `ROOT_FOLDER_ID`, isi ID folder induk resmi Anda. Contoh: folder `DATABASE SIDOMAS POLDAGRI (DEMO)` memiliki ID `17fnSh8_TpSbHP5MMjWvKr_z5SSCTVfE1` (diambil dari URL folder). `PDF_FOLDER_ID` dan `LOGO_FOLDER_ID` sudah disamakan ke folder itu — tidak perlu dua folder terpisah.
2. Deploy sebagai Web app: Execute as **Me**, Who has access **Anyone**. Salin URL yang berakhiran `/exec`.
3. Isi `.env`: `GDRIVE_URL` (URL tadi) dan `GDRIVE_SECRET` (sama dengan SECRET di Apps Script).
4. Uji: `node server/test-drive.js`.
5. **Wajib** jika memperbarui skrip yang sudah terpasang: Deploy > Manage deployments > ikon pensil > Version **New version** > Deploy (URL tidak berubah). Versi lama tidak punya aksi `ensure_folder`, sehingga unggahan baru bisa menumpuk di folder induk.
6. Alur file: pendaftar mengunggah berkas ke penyimpanan sementara di server dan **menunggu persetujuan admin**. Sebelum disetujui ormas tidak tampil di katalog dan belum ada folder/berkas di Drive. Saat admin menyetujui, server membuat **satu** folder `Ormas-XXX - Nama Ormas` di dalam folder induk `ROOT_FOLDER_ID` (`DATABASE SIDOMAS POLDAGRI (DEMO)`), lalu **semua berkas ormas itu (PDF dan logo/foto profil)** diunggah ke folder yang sama. Satu ormas = satu folder; berkas tidak pernah tercampur dengan ormas lain dan tidak tersebar di luar folder induk.
7. Perubahan dari portal ormas (teks, logo, atau PDF) juga **menunggu verifikasi admin**: katalog dan Drive masih memakai data lama sampai admin menyetujui. Saat disetujui, data baru dipakai katalog, berkas lama di Drive dihapus, lalu berkas baru diunggah ke folder ormas yang sama.
8. Setelah mengganti `ROOT_FOLDER_ID` dan deploy ulang, jalankan `npm run organize-drive` **sekali** untuk memindahkan file lama yang masih berada di folder induk lama ke folder ormas di dalam `ROOT_FOLDER_ID` yang baru. Ini hanya memindahkan file yang masih tercatat di database.
9. Sisa file uji/upload gagal yang **tidak tercatat di database**: `npm run bersihkan-sisa-drive -- --confirm`. Perintah ini membuang file lepas di folder induk ke Sampah Drive, tetapi tidak menyentuh file yang masih dipakai aplikasi dan tidak menyentuh isi folder ormas. File di dalam `BACKUP-DATABASE` juga aman.
10. `npm run laporan-drive` menampilkan file lepas di induk dan daftar folder ormas beserta jumlah isinya (tanpa mengubah apa pun). Untuk membuang folder uji/yatim yang kodenya tidak ada di database: `npm run bersihkan-folder-yatim -- --confirm`. Folder ormas aktif dan `BACKUP-DATABASE` tidak tersentuh.
- Data teks (ormas, akun, log) tetap di database SQLite (`data/sidomas.db`). Database itu dicadangkan otomatis ke folder `BACKUP-DATABASE` di Drive (14 backup terbaru disimpan). Backup manual: `npm run backup-now`.
- Disarankan batas ukuran PDF 10 MB (menu Pengaturan).

## Tayang di Fly.io
Lihat panduan langkah demi langkah dari pengembang. Ringkasnya: `fly apps create`, `fly volumes create sidomas_data`, `fly secrets set ...`, `fly deploy`. File `Dockerfile`, `fly.toml`, dan `.github/workflows/fly-deploy.yml` sudah tersedia. Setiap push ke branch `main` otomatis memperbarui aplikasi jika `FLY_API_TOKEN` sudah diisi di GitHub.
Variabel wajib di server produksi: `SECRET`, `ADMIN_INITIAL_PASSWORD`, `APP_URL`, `GDRIVE_URL`, `GDRIVE_SECRET` (dan SMTP agar email reset password terkirim). Simpan nilai `SECRET` di tempat aman: tanpa itu sesi login admin/ormas dan tautan reset password tidak lagi dapat diverifikasi.

## Perintah bantu (terminal)
`npm run admins` · `npm run reset-admin -- USERNAME [PASSWORDBARU]` · `npm run set-email -- USERNAME EMAIL` · `npm run check-reset -- EMAIL` · `npm run test-email -- EMAIL` · `npm run backup-now` · `npm run organize-drive`

## Keamanan
- Endpoint publik hanya melayani **Company Profile** dari ormas berstatus `Publik` dan katalog aktif; berkas `pending` dan PDF selain Company Profile tidak pernah bisa diakses publik, meski tetap tersimpan di Drive. Autentikasi admin/ormas tetap memakai hash password + JWT terpisah dari akses baca dokumen.
- Password disimpan sebagai hash; pembatas percobaan login aktif; unggahan diperiksa isinya.
- Jangan menaruh `.env`, `data/`, atau kunci rahasia di GitHub. `.gitignore` sudah mengecualikannya.
- Jangan memakai logo atau identitas resmi Pemkot Yogyakarta tanpa izin.
