// ===== SIDOMAS: jembatan penyimpanan Google Drive =====
// Tempel seluruh isi file ini di https://script.google.com (proyek baru) memakai akun Google PEMILIK kedua folder Drive.
// Lalu ubah SECRET di bawah menjadi kunci rahasia acak yang panjang (minimal 30 karakter).
//
// Struktur folder (dibuat otomatis oleh skrip ini):
//   DATABASE PDF ORMAS  (PDF_FOLDER_ID)
//     ├─ Ormas-001 - Nama Ormas A/ <- semua PDF milik Ormas A
//     ├─ Ormas-002 - Nama Ormas B/
//     └─ BACKUP-DATABASE/ <- backup database harian
//   DATABASE LOGO ORMAS (LOGO_FOLDER_ID)
//     ├─ Ormas-001 - Nama Ormas A/ <- logo milik Ormas A
//     └─ Ormas-002 - Nama Ormas B/
//
// PENTING saat memperbarui skrip yang sudah pernah dipasang: setelah menempel kode baru, klik
// Deploy > Manage deployments > ikon pensil > Version: "New version" > Deploy.
// URL /exec tetap sama, jadi GDRIVE_URL di .env tidak perlu diubah.

const PDF_FOLDER_ID = '1ZuLRaw3GF-sTYMpxOpTe53Y_kZSHp7jr';   // folder penampung PDF dokumen ormas
const LOGO_FOLDER_ID = '1gSAG1cOk3pH8Oj1pF4b_krPhkc5dl8yc';  // folder penampung logo ormas
const SECRET = 'GANTI_dengan_kunci_rahasia_acak_yang_panjang'; // harus sama dengan GDRIVE_SECRET
const BACKUP_FOLDER_NAME = 'BACKUP-DATABASE';                  // dibuat otomatis di dalam folder PDF
const KEEP_BACKUPS = 14;                                        // jumlah backup database terbaru yang disimpan

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
function inAllowed_(file, ids) {
  const bk = backupFolder_().getId();
  const parents = file.getParents();
  while (parents.hasNext()) {
    const p = parents.next();
    const pid = p.getId();
    if (ids.indexOf(pid) >= 0) return true;
    if (pid === bk) continue;
    const gp = p.getParents();
    while (gp.hasNext()) {
      if (ids.indexOf(gp.next().getId()) >= 0) return true;
    }
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
    if (!b || SECRET.indexOf('GANTI') === 0 || b.secret !== SECRET) return out_({ ok: false, error: 'Tidak diizinkan' });

    if (b.action === 'upload') {
      const kind = ['logo', 'backup'].indexOf(b.kind) >= 0 ? b.kind : 'pdf';
      const folder = folderFor_(kind, b.folder); // b.folder = nama ormas (diabaikan untuk backup)
      const blob = Utilities.newBlob(Utilities.base64Decode(b.data), String(b.mime || 'application/pdf'), String(b.name || 'berkas'));
      const file = folder.createFile(blob);
      if (kind === 'backup') pruneBackups_(folder);
      return out_({ ok: true, id: file.getId(), size: file.getSize() });
    }

    if (b.action === 'download') {
      const file = DriveApp.getFileById(String(b.id));
      if (!inAllowed_(file, [PDF_FOLDER_ID, LOGO_FOLDER_ID])) return out_({ ok: false, error: 'File bukan bagian dari folder SIDOMAS' });
      return out_({ ok: true, data: Utilities.base64Encode(file.getBlob().getBytes()) });
    }

    if (b.action === 'delete') {
      const file = DriveApp.getFileById(String(b.id));
      if (!inAllowed_(file, [PDF_FOLDER_ID, LOGO_FOLDER_ID, backupFolder_().getId()])) return out_({ ok: false, error: 'File bukan bagian dari folder SIDOMAS' });
      file.setTrashed(true);
      return out_({ ok: true });
    }

    // Memindahkan file lama ke folder ormasnya (dipakai perintah: npm run organize-drive)
    if (b.action === 'move') {
      const kind = b.kind === 'logo' ? 'logo' : 'pdf';
      const file = DriveApp.getFileById(String(b.id));
      if (!inAllowed_(file, [PDF_FOLDER_ID, LOGO_FOLDER_ID])) return out_({ ok: false, error: 'File bukan bagian dari folder SIDOMAS' });
      file.moveTo(folderFor_(kind, b.folder));
      return out_({ ok: true });
    }

    // Nama ormas berubah: ganti nama foldernya di folder PDF dan folder Logo (ID file tidak berubah)
    if (b.action === 'rename_folder') {
      const to = safeName_(b.to);
      if (safeName_(b.from) === to) return out_({ ok: true });
      ['pdf', 'logo'].forEach(function (k) {
        const src = ormasFolder_(k, b.from, false);
        if (src && !ormasFolder_(k, b.to, false)) src.setName(to);
      });
      return out_({ ok: true });
    }

    // Ormas dihapus atau unggahan dibatalkan: folder ormas dibuang hanya jika sudah KOSONG
    if (b.action === 'trash_folder') {
      ['pdf', 'logo'].forEach(function (k) {
        const f = ormasFolder_(k, b.name, false);
        if (f && !f.getFiles().hasNext() && !f.getFolders().hasNext()) f.setTrashed(true);
      });
      return out_({ ok: true });
    }

    // Dipakai server SIDOMAS: kumpulkan file (PDF/logo) satu ormas ke folder "Ormas-001 - Nama Ormas".
    // Folder dicari lewat kode ormas, sehingga ikut berganti nama jika nama ormas berubah.
    if (b.action === 'organize') {
      const kode = String(b.kode || '');
      if (!/^Ormas-\d+$/.test(kode)) return out_({ ok: false, error: 'Kode ormas tidak valid' });
      const nm = safeName_(kode + ' - ' + b.nama);
      let moved = 0;
      (b.ids || []).forEach(function (id) {
        const file = DriveApp.getFileById(String(id));
        if (!inAllowed_(file, [PDF_FOLDER_ID, LOGO_FOLDER_ID])) return;
        const kind = isIn_(file, LOGO_FOLDER_ID) ? 'logo' : 'pdf';
        const folder = kodeFolder_(kind, kode, nm, true);
        const parents = file.getParents();
        if (parents.hasNext() && parents.next().getId() === folder.getId()) return;
        file.moveTo(folder);
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

    return out_({ ok: false, error: 'Aksi tidak dikenal' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}
