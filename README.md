# SIDOMAS: Sistem Digitalisasi Data Organisasi Kemasyarakatan

Aplikasi web untuk mengelola data dan dokumen organisasi kemasyarakatan (ormas) Bidang Poldagri.
Stack: React + TypeScript + Tailwind CSS (client), Node.js + Express + SQLite (server).
Sistem ini adalah sistem administrasi dan dokumentasi internal dengan katalog publik, bukan situs resmi Pemerintah Kota Yogyakarta.

## Fitur
- **Katalog publik**: cari, filter, urutkan. Halaman ormas menampilkan logo, struktur pengurus, email, lokasi kantor (dengan peta mini), dan 5 dokumen PDF.
- **Dokumen terbatas**: buka/unduh PDF memakai username + password harian per ormas (berganti otomatis tiap hari, hanya terlihat admin).
- **5 dokumen wajib**: SK Pengurusan, Surat Keterangan Domisili, Program Kerja, Salinan Badan Hukum, SKTO.
- **Portal ormas** (`/ormas-login`): tiap ormas punya akun tetap untuk memperbarui data dan dokumennya sendiri.
- **Dashboard admin**: statistik, data ormas, password harian, manajemen admin (tambah, ubah, nonaktifkan, hapus), ekspor CSV, log aktivitas, pengaturan.
- **Verifikasi perubahan**: perubahan data atau PDF dari portal ormas ditahan dulu. Katalog publik dan Google Drive tetap memakai data lama sampai admin menekan **Verifikasi** (atau **Tolak**) di Detail Ormas.
- **Status validasi** (dropdown Terdata / Terdaftar / Teregister) dan **jumlah anggota** (total, perempuan, lansia, disabilitas; angka saja). Jumlah anggota tampil di katalog satu baris dengan ketua, sekretaris, dan bendahara.
- **Dokumentasi kegiatan** (opsional): unggah PDF atau tempel tautan (mis. Google Drive), plus tautan Instagram ormas.
- **Peringatan masa berlaku SKTO / Legal Standing**: label "Segera berakhir" / "Sudah kedaluwarsa" di Data Ormas, menu **Dokumen Kedaluwarsa** (dihitung dari tanggal Berlaku s/d), dan pengingat otomatis.
- **Notifikasi admin**: lonceng dengan titik merah, hilang setelah klik "Sudah dibaca". Notifikasi HP (Web Push): "Admin (nama) Telah Memperbarui, CEK SELENGKAPNYA!" dan "Ormas (nama) Telah Melakukan Perubahan, CEK SELENGKAPNYA DAN KONFIRMASI PERUBAHAN". Aktifkan per perangkat di menu Notifikasi (butuh HTTPS atau localhost).
- **Sesi PDF terkunci admin**: jika admin membuat ulang password harian, ormas yang sedang membuka PDF otomatis mendapat pesan "Sesi Anda Telah Habis" (dicek tiap 3 detik).
- **Penyimpanan Google Drive**: PDF dan logo di dua folder Drive. Tiap ormas otomatis punya subfolder sendiri bernama sesuai nama ormas (berisi PDF-nya di folder PDF, dan logonya di folder Logo), plus backup database harian otomatis.

## Role dan hak akses
- **Surveyor**: semua menu dan hak akses, termasuk Manajemen Admin, Ekspor Kredensial, dan Pengaturan.
- **Admin Digitalisasi Ormas**: Dashboard, Data Ormas (lihat, ubah, verifikasi), Dokumen Kedaluwarsa, Notifikasi, Password Harian, Ekspor Data (CSV ormas), dan Log Aktivitas. Tanpa Manajemen Admin, Ekspor Kredensial, dan Pengaturan.
- **Kepala Bidang Poldagri**: hak akses sama dengan Admin Digitalisasi Ormas.
- Menu dan tombol mengikuti hak akses role; server tetap memeriksa izin pada setiap permintaan. Akun admin awal (`admin`) berperan Surveyor. Pada database lama, migrasi berjalan sekali saat server start dan memastikan minimal satu akun aktif tetap berperan Surveyor.

## Menjalankan di komputer sendiri
Prasyarat: Node.js 18 atau lebih baru.
1. `npm install`, lalu `cd client`, `npm install`, `cd ..` (atau `npm run setup`).
2. Salin `.env.example` menjadi `.env`, lalu isi seperlunya.
3. `npm run dev`, lalu buka http://localhost:5173
4. Saat database pertama kali dibuat, password admin awal dicetak sekali di terminal (atau diambil dari `ADMIN_INITIAL_PASSWORD`). Username: `admin`. Sistem meminta ganti password dan mengisi email saat login pertama.

## Google Drive
1. Buka https://script.google.com dengan akun pemilik folder Drive, buat proyek baru, tempel isi `docs/google-apps-script.gs`, lalu ganti `SECRET` dengan kunci acak panjang.
2. Deploy sebagai Web app: Execute as **Me**, Who has access **Anyone**. Salin URL yang berakhiran `/exec`.
3. Isi `.env`: `GDRIVE_URL` (URL tadi) dan `GDRIVE_SECRET` (sama dengan SECRET di Apps Script).
4. Uji: `node server/test-drive.js`.
5. Jika memperbarui skrip yang sudah terpasang: Deploy > Manage deployments > ikon pensil > Version **New version** > Deploy (URL tidak berubah).
6. Untuk memindahkan PDF/logo lama ke folder masing-masing ormas: `npm run organize-drive` (cukup sekali).
- Data teks (ormas, akun, log) tetap di database SQLite (`data/sidomas.db`). Database itu dicadangkan otomatis ke folder `BACKUP-DATABASE` di Drive (14 backup terbaru disimpan). Backup manual: `npm run backup-now`.
- Disarankan batas ukuran PDF 10 MB (menu Pengaturan).

## Tayang di Fly.io
Lihat panduan langkah demi langkah dari pengembang. Ringkasnya: `fly apps create`, `fly volumes create sidomas_data`, `fly secrets set ...`, `fly deploy`. File `Dockerfile`, `fly.toml`, dan `.github/workflows/fly-deploy.yml` sudah tersedia. Setiap push ke branch `main` otomatis memperbarui aplikasi jika `FLY_API_TOKEN` sudah diisi di GitHub.
Variabel wajib di server produksi: `SECRET`, `ADMIN_INITIAL_PASSWORD`, `APP_URL`, `GDRIVE_URL`, `GDRIVE_SECRET` (dan SMTP agar email reset password terkirim). Simpan nilai `SECRET` di tempat aman: tanpa itu password harian yang tersimpan tidak bisa ditampilkan lagi.

## Perintah bantu (terminal)
`npm run admins` · `npm run reset-admin -- USERNAME [PASSWORDBARU]` · `npm run set-email -- USERNAME EMAIL` · `npm run check-reset -- EMAIL` · `npm run test-email -- EMAIL` · `npm run backup-now` · `npm run organize-drive`

## Keamanan
- PDF tidak punya URL publik permanen. Akses lewat token 30 menit yang terikat satu ormas dan tidak melewati pergantian hari.
- Password disimpan sebagai hash; pembatas percobaan login aktif; unggahan diperiksa isinya.
- Jangan menaruh `.env`, `data/`, atau kunci rahasia di GitHub. `.gitignore` sudah mengecualikannya.
- Jangan memakai logo atau identitas resmi Pemkot Yogyakarta tanpa izin.
