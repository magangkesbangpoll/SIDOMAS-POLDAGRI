// ===== SIDOMAS: jembatan penyimpanan Google Drive =====
// Tempel seluruh isi file ini di https://script.google.com (proyek baru) memakai akun Google PEMILIK kedua folder Drive.
// Lalu ubah SECRET di bawah menjadi kunci rahasia acak yang panjang (minimal 30 karakter).
//
// Struktur folder (satu folder induk resmi, dibuat/dipakai sesuai ROOT_FOLDER_ID):
//   DATABASE SIDOMAS POLDAGRI (DEMO)  (ROOT_FOLDER_ID)
//     ├─ Ormas-001 - Nama Ormas A/ <- SATU folder ini berisi SEMUA file Ormas A: PDF + logo/foto profil
//     ├─ Ormas-002 - Nama Ormas B/ <- SATU folder ini berisi SEMUA file Ormas B: PDF + logo/foto profil
//     └─ BACKUP-DATABASE/ <- backup database harian
//
// Tidak ada lagi folder induk PDF dan Logo terpisah. Semua folder ormas dan backup berada
// di dalam satu folder induk yang sama. Alur pendaftaran: berkas pendaftar disimpan sementara
// di server. Setelah admin menyetujui, server membuat SATU folder "Ormas-XXX - Nama Ormas"
// lebih dulu, lalu mengunggah PDF dan logo/foto profil ormas itu ke folder yang SAMA.
//
// PENTING saat memperbarui skrip yang sudah pernah dipasang: setelah menempel kode baru, klik
// Deploy > Manage deployments > ikon pensil > Version: "New version" > Deploy.
// URL /exec tetap sama, jadi GDRIVE_URL di .env tidak perlu diubah.

// SATU folder induk resmi. Ganti hanya kalau Anda memakai folder lain.
// ID di bawah adalah folder "DATABASE SIDOMAS POLDAGRI (DEMO)".
const ROOT_FOLDER_ID = '17fnSh8_TpSbHP5MMjWvKr_z5SSCTVfE1';
const PDF_FOLDER_ID = ROOT_FOLDER_ID;  // kompatibilitas dengan kode lama
const LOGO_FOLDER_ID = ROOT_FOLDER_ID; // kompatibilitas dengan kode lama
const SECRET = 'GANTI_dengan_kunci_rahasia_acak_yang_panjang'; // harus sama dengan GDRIVE_SECRET
const BACKUP_FOLDER_NAME = 'BACKUP-DATABASE';                  // dibuat otomatis di dalam folder PDF
const KEEP_BACKUPS = 14;                                        // jumlah backup database terbaru yang disimpan
const MARK = 'SIDOMAS';                                         // penanda pada deskripsi file hasil unggahan SIDOMAS

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function backupFolder_() {
  const pdf = DriveApp.getFolderById(PDF_FOLDER_ID);
  const it = pdf.getFoldersByName(BACKUP_FOLDER_NAME);
  return it.hasNext() ? it.next() : pdf.createFolder(BACKUP_FOLDER_NAME);
}

// Nama folder ormas = nama ormas, dibersihkan dari karakter yang tidak aman.
// Nama "BACKUP-DATABASE" dilindungi supaya tidak pernah bertabrakan dengan folder backup.
function safeName_(n) {
  let s = String(n || '').replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!s) s = 'Tanpa Nama';
  if (s.toLowerCase() === BACKUP_FOLDER_NAME.toLowerCase()) s += ' (ormas)';
  return s;
}

function rootFor_(kind) {
  return DriveApp.getFolderById(kind === 'logo' ? LOGO_FOLDER_ID : PDF_FOLDER_ID);
}

// Satu folder induk saja: PDF_FOLDER_ID dan LOGO_FOLDER_ID sekarang sama, jadi hindari memproses dua kali.
function roots_() {
  const seen = {}, out = [];
  ['pdf', 'logo'].forEach(function (kind) {
    const r = rootFor_(kind);
    if (!seen[r.getId()]) { seen[r.getId()] = true; out.push(r); }
  });
  return out;
}

// Cari folder ormas di dalam folder PDF/Logo; buat jika belum ada (create = true).
// Dikunci agar beberapa unggahan yang datang bersamaan tidak membuat folder ganda.
function ormasFolder_(kind, name, create) {
  const root = rootFor_(kind);
  const nm = safeName_(name);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const it = root.getFoldersByName(nm);
    if (it.hasNext()) return it.next();
    return create ? root.createFolder(nm) : null;
  } finally {
    lock.releaseLock();
  }
}

// Cari folder ormas berdasarkan kode ("Ormas-001 - ..."); ganti nama jika nama ormas berubah; buat jika create = true.
function kodeFolder_(kind, kode, nm, create) {
  const root = rootFor_(kind);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const it = root.getFolders();
    while (it.hasNext()) {
      const f = it.next();
      if (f.getName().indexOf(kode + ' - ') === 0) { if (nm && f.getName() !== nm) f.setName(nm); return f; }
    }
    return create ? root.createFolder(nm) : null;
  } finally {
    lock.releaseLock();
  }
}

// Folder resmi satu ormas: cari berdasarkan kode, rapi juga folder lama yang namanya tanpa kode.
function folderForOrmas_(kind, kode, nama) {
  const nm = safeName_(kode + ' - ' + nama);
  let f = kodeFolder_(kind, kode, nm, false);
  if (!f && nama) {
    f = ormasFolder_(kind, nama, false); // kompatibilitas dengan folder lama bernama polos
    if (f) f.setName(nm);
  }
  return f || kodeFolder_(kind, kode, nm, true);
}

// SATU folder ormas untuk semua jenis berkas (PDF dan logo) di dalam DATABASE PDF ORMAS.
function folderOrmas_(kode, nama) {
  return folderForOrmas_('pdf', kode, nama);
}

// Keamanan: folder tujuan upload harus masih berada di dalam folder SIDOMAS (PDF/Logo).
function folderAllowed_(folder, rootId) {
  const p = folder.getParents();
  while (p.hasNext()) {
    const par = p.next();
    if (par.getId() === rootId) return true;
    const gp = par.getParents();
    while (gp.hasNext()) if (gp.next().getId() === rootId) return true;
  }
  return false;
}

function isIn_(file, rootId) {
  const parents = file.getParents();
  while (parents.hasNext()) {
    const p = parents.next();
    if (p.getId() === rootId) return true;
    const gp = p.getParents();
    while (gp.hasNext()) if (gp.next().getId() === rootId) return true;
  }
  return false;
}

function folderFor_(kind, name) {
  if (kind === 'backup') return backupFolder_();
  return name ? ormasFolder_(kind, name, true) : rootFor_(kind);
}

// Keamanan: hanya file di dalam folder SIDOMAS (atau di dalam subfolder ormas) yang boleh dibaca atau dihapus.
// File backup hanya boleh lewat daftar id yang disebut eksplisit (tidak ikut aturan subfolder).
function inAllowed_(file) {
  // Utama: file yang diunggah SIDOMAS ditandai deskripsinya "SIDOMAS".
  // Fallback: file lama (sebelum penanda) tetap diterima bila masih di root SIDOMAS atau subfoldernya.
  try { if (String(file.getDescription() || '') === MARK) return true; } catch (e) {}
  const ids = [PDF_FOLDER_ID, LOGO_FOLDER_ID, backupFolder_().getId()];
  const bk = backupFolder_().getId();
  const parents = file.getParents();
  while (parents.hasNext()) {
    const p = parents.next();
    const pid = p.getId();
    if (ids.indexOf(pid) >= 0) return true;
    if (pid === bk) continue;
    const gp = p.getParents();
    while (gp.hasNext()) { if (ids.indexOf(gp.next().getId()) >= 0) return true; }
  }
  return false;
}

function pruneBackups_(folder) {
  const list = [];
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    list.push({ f: f, t: f.getDateCreated().getTime() });
  }
  list.sort(function (a, b) { return b.t - a.t; });
  list.slice(KEEP_BACKUPS).forEach(function (x) { x.f.setTrashed(true); });
}

function doGet() {
  return out_({ ok: true, info: 'Jembatan Drive SIDOMAS aktif' });
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (!b) return out_({ ok: false, error: 'Isi permintaan kosong atau bukan JSON' });
    if (SECRET.indexOf('GANTI') === 0) return out_({ ok: false, error: 'SECRET di Apps Script masih placeholder. Ganti baris const SECRET dengan kunci acak yang sama dengan GDRIVE_SECRET di file .env' });
    if (b.secret !== SECRET) return out_({ ok: false, error: 'Secret tidak cocok. Samakan GDRIVE_SECRET di .env dengan SECRET di Apps Script, lalu Deploy > Manage deployments > New version' });

    if (b.action === 'upload') {
      const kind = ['logo', 'backup'].indexOf(b.kind) >= 0 ? b.kind : 'pdf';
      let folder;
      const kode = String(b.kode || '');
      if (kind !== 'backup' && /^Ormas-\d+$/.test(kode)) {
        // PDF dan logo masuk ke SATU folder ormas yang sama.
        folder = folderOrmas_(kode, b.nama);
      } else if (b.parent) {
        // Kompatibilitas untuk pemanggil lama yang masih mengirim parent.
        folder = DriveApp.getFolderById(String(b.parent));
        if (kind !== 'backup' && !folderAllowed_(folder, PDF_FOLDER_ID) && !folderAllowed_(folder, LOGO_FOLDER_ID)) {
          const ketemu = [];
          const it = folder.getParents();
          while (it.hasNext()) ketemu.push(it.next().getId());
          return out_({ ok: false, error: 'Folder tujuan bukan bagian dari SIDOMAS. Parent=' + ketemu.join(',') });
        }
      } else {
        folder = folderFor_(kind, b.folder); // kompatibilitas: b.folder = nama ormas (diabaikan untuk backup)
      }
      const blob = Utilities.newBlob(Utilities.base64Decode(b.data), String(b.mime || 'application/pdf'), String(b.name || 'berkas'));
      const file = folder.createFile(blob);
      file.setDescription(MARK); // penanda kepemilikan SIDOMAS, dipakai download/delete agar tidak bergantung struktur folder
      if (kind === 'backup') pruneBackups_(folder);
      return out_({ ok: true, id: file.getId(), size: file.getSize(), parent: folder.getId() });
    }

    if (b.action === 'download') {
      const file = DriveApp.getFileById(String(b.id));
      if (!inAllowed_(file)) return out_({ ok: false, error: 'File bukan bagian dari folder SIDOMAS' });
      return out_({ ok: true, data: Utilities.base64Encode(file.getBlob().getBytes()) });
    }

    if (b.action === 'delete') {
      const file = DriveApp.getFileById(String(b.id));
      if (!inAllowed_(file)) return out_({ ok: false, error: 'File bukan bagian dari folder SIDOMAS' });
      file.setTrashed(true);
      return out_({ ok: true });
    }

    // Memindahkan file lama ke folder ormasnya (dipakai perintah: npm run organize-drive)
    if (b.action === 'move') {
      const kind = b.kind === 'logo' ? 'logo' : 'pdf';
      const file = DriveApp.getFileById(String(b.id));
      if (!inAllowed_(file)) return out_({ ok: false, error: 'File bukan bagian dari folder SIDOMAS' });
      file.moveTo(folderFor_(kind, b.folder));
      return out_({ ok: true });
    }

    // Nama ormas berubah: ganti nama foldernya di folder PDF dan folder Logo (ID file tidak berubah)
    if (b.action === 'rename_folder') {
      const to = b.kode ? safeName_(b.kode + ' - ' + b.to) : safeName_(b.to);
      const from = b.kode ? b.kode + ' - ' + b.from : b.from;
      if (safeName_(from) === to) return out_({ ok: true });
      ['pdf', 'logo'].forEach(function (k) {
        const src = b.kode ? kodeFolder_(k, b.kode, null, false) : ormasFolder_(k, b.from, false);
        if (src && src.getName() !== to) src.setName(to);
      });
      return out_({ ok: true });
    }

    // Unggahan dibatalkan: folder ormas dibuang hanya jika masih KOSONG (kompatibilitas folder lama).
    if (b.action === 'trash_folder') {
      ['pdf', 'logo'].forEach(function (k) {
        const f = b.kode ? kodeFolder_(k, b.kode, null, false) : ormasFolder_(k, b.name, false);
        if (f && !f.getFiles().hasNext() && !f.getFolders().hasNext()) f.setTrashed(true);
      });
      return out_({ ok: true });
    }

    // Dipanggil server SEBELUM mengunggah berkas ormas: buat/pastikan folder PDF dan Logo tersedia.
    // Id folder dikembalikan supaya berkas langsung masuk ke folder yang benar (bukan ke induk).
    if (b.action === 'ensure_folder') {
      const kode = String(b.kode || '');
      if (!/^Ormas-\d+$/.test(kode)) return out_({ ok: false, error: 'Kode ormas tidak valid' });
      // Tandai apakah folder sudah ada (termasuk folder lama bernama polos) sebelum dibuat/diganti nama.
      const sudahAda = !!kodeFolder_('pdf', kode, null, false) || !!(b.nama && ormasFolder_('pdf', b.nama, false));
      const folder = folderOrmas_(kode, b.nama);
      const id = folder.getId();
      // pdf/logo dikirim sama = satu folder untuk semua berkas ormas ini.
      return out_({ ok: true, folder: id, pdf: id, logo: id, nama: folder.getName(), baru: !sudahAda });
    }

    // Dipakai server SIDOMAS: kumpulkan semua file (PDF/logo) satu ormas ke SATU folder "Ormas-001 - Nama Ormas".
    // Folder dicari lewat kode ormas, sehingga ikut berganti nama jika nama ormas berubah.
    if (b.action === 'organize') {
      const kode = String(b.kode || '');
      if (!/^Ormas-\d+$/.test(kode)) return out_({ ok: false, error: 'Kode ormas tidak valid' });
      const folder = folderOrmas_(kode, b.nama);
      let moved = 0;
      (b.ids || []).forEach(function (id) {
        const file = DriveApp.getFileById(String(id));
        if (!inAllowed_(file)) return;
        const parents = file.getParents();
        if (parents.hasNext() && parents.next().getId() === folder.getId()) return;
        file.moveTo(folder); // logo lama di root Logo ikut dipindah ke folder ormas yang sama
        moved++;
      });
      return out_({ ok: true, moved: moved });
    }

    // Ormas dihapus: buang folder ormas (beserta isinya) ke Sampah Drive
    if (b.action === 'delete_folder') {
      const kode = String(b.kode || '');
      if (!/^Ormas-\d+$/.test(kode)) return out_({ ok: false, error: 'Kode ormas tidak valid' });
      ['pdf', 'logo'].forEach(function (k) {
        const f = kodeFolder_(k, kode, null, false);
        if (f) f.setTrashed(true);
      });
      return out_({ ok: true });
    }

    // Bersihkan file lepas di folder induk (PDF/Logo) yang TIDAK tercatat di database.
    // Daftar id yang masih dipakai dikirim server, jadi file asli tidak pernah tersentuh.
    if (b.action === 'bersihkan_induk') {
      const pakai = {};
      (b.ids || []).forEach(function (id) { pakai[String(id)] = true; });
      const nama = [];
      let dihapus = 0;
      roots_().forEach(function (root) {
        const files = root.getFiles();
        while (files.hasNext()) {
          const f = files.next();
          if (pakai[f.getId()]) continue;
          if (f.getMimeType() === MimeType.FOLDER) continue;
          f.setTrashed(true);
          dihapus++;
          nama.push(f.getName());
        }
      });
      return out_({ ok: true, dihapus: dihapus, nama: nama });
    }

    // Inventory: lihat file lepas di induk dan isi tiap folder ormas. Tidak mengubah apa pun.
    if (b.action === 'laporan_drive') {
      function ringkas(root, label) {
        const folders = [];
        const it = root.getFolders();
        while (it.hasNext()) {
          const f = it.next();
          let jumlah = 0;
          const files = f.getFiles();
          while (files.hasNext()) { files.next(); jumlah++; }
          folders.push({ id: f.getId(), nama: f.getName(), jumlah: jumlah });
        }
        let lepas = 0;
        const files = root.getFiles();
        while (files.hasNext()) { files.next(); lepas++; }
        return { label: label, id: root.getId(), lepas: lepas, folders: folders };
      }
      return out_({ ok: true, roots: roots_().map(function (r) { return ringkas(r, 'DATABASE SIDOMAS POLDAGRI (DEMO)'); }) });
    }

    // Buang folder ormas yang kodenya tidak ada di database, termasuk folder uji TES-SIDOMAS.
    // Hanya folder di root PDF/Logo yang namanya diawali "Ormas-" atau mengandung "TES-SIDOMAS".
    if (b.action === 'hapus_folder_yatim') {
      const pakai = {};
      (b.kodes || []).forEach(function (k) { pakai[String(k)] = true; });
      const nama = [];
      let dihapus = 0;
      roots_().forEach(function (root) {
        const it = root.getFolders();
        while (it.hasNext()) {
          const f = it.next();
          const nm = f.getName();
          if (nm === BACKUP_FOLDER_NAME) continue;
          const uji = nm.indexOf('TES-SIDOMAS') >= 0;
          const m = nm.match(/^Ormas-(\d+)/);
          const kode = m ? 'Ormas-' + m[1] : '';
          if (!uji && !kode) continue;
          if (kode && pakai[kode]) continue; // folder ormas yang masih aktif, jangan disentuh
          f.setTrashed(true);
          dihapus++;
          nama.push(nm + ' (' + root.getName() + ')');
        }
      });
      return out_({ ok: true, dihapus: dihapus, nama: nama });
    }

    return out_({ ok: false, error: 'Aksi tidak dikenal' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}
