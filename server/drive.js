// Klien penyimpanan Google Drive (lewat jembatan Google Apps Script, lihat docs/google-apps-script.gs)
import fs from 'fs';

export const driveOn = () => !!(process.env.GDRIVE_URL && process.env.GDRIVE_SECRET);

async function call(payload) {
  let r;
  try {
    r = await fetch(process.env.GDRIVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: process.env.GDRIVE_SECRET, ...payload }),
      redirect: 'follow',
      signal: AbortSignal.timeout(180000),
    });
  } catch (e) {
    throw new Error(`tidak bisa menghubungi Google Drive (${e.message})`);
  }
  const text = await r.text();
  let j;
  try { j = JSON.parse(text); } catch { throw new Error('respons Google Drive tidak valid. Periksa GDRIVE_URL dan pengaturan deployment Apps Script (akses harus "Anyone")'); }
  if (!j.ok) throw new Error(`[${payload.action || 'drive'}] ${j.error || 'ditolak oleh Google Drive'}`);
  return j;
}

// opts.kind: 'pdf' (bawaan) | 'logo' | 'backup'; opts.mime: tipe file
// opts.kode + opts.nama: dipakai Apps Script untuk memilih folder ormas yang benar.
// opts.parent: kompatibilitas untuk script lama; tidak dipakai jika kode dikirim.
export async function driveUpload(filePath, name, opts = {}) {
  return (await call({ action: 'upload', name, kind: opts.kind || 'pdf', mime: opts.mime || 'application/pdf', kode: opts.kode || undefined, nama: opts.nama || undefined, parent: opts.parent || undefined, data: fs.readFileSync(filePath).toString('base64') })).id;
}
// Pastikan SATU folder ormas ada SEBELUM berkas diunggah, lalu pakai id-nya sebagai tujuan upload PDF dan logo.
export async function driveEnsureFolder(kode, nama) {
  return call({ action: 'ensure_folder', kode, nama });
}
export async function driveDownload(id) {
  return Buffer.from((await call({ action: 'download', id })).data, 'base64');
}
export async function driveDelete(id) {
  try { await call({ action: 'delete', id }); } catch (e) { console.error('Gagal menghapus file di Google Drive:', e.message); }
}

// Merapikan berkas lama ke folder ormas: "Ormas-001 - Nama Ormas". Untuk unggahan baru, pakai driveEnsureFolder + driveUpload({ parent }).
export async function driveOrganize(kode, nama, ids) {
  return call({ action: 'organize', kode, nama, ids });
}
export async function driveDeleteFolder(kode) {
  try { await call({ action: 'delete_folder', kode }); } catch (e) { console.error('Gagal menghapus folder ormas di Google Drive:', e.message); }
}
// Buang file lepas di folder induk yang tidak lagi tercatat di database (sisa uji/upload gagal).
export async function driveCleanRoot(ids) {
  return call({ action: 'bersihkan_induk', ids });
}
// Lihat isi Drive: file lepas di induk + tiap folder ormas dan jumlah isinya.
export async function driveLaporan() {
  return call({ action: 'laporan_drive' });
}
// Buang folder ormas yang kodenya tidak ada di database (termasuk folder uji TES-SIDOMAS).
export async function driveCleanFoldersYatim(kodes) {
  return call({ action: 'hapus_folder_yatim', kodes });
}