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
  if (!j.ok) throw new Error(j.error || 'ditolak oleh Google Drive');
  return j;
}

// opts.kind: 'pdf' (bawaan) | 'logo' | 'backup'; opts.mime: tipe file
export async function driveUpload(filePath, name, opts = {}) {
  return (await call({ action: 'upload', name, kind: opts.kind || 'pdf', mime: opts.mime || 'application/pdf', data: fs.readFileSync(filePath).toString('base64') })).id;
}
export async function driveDownload(id) {
  return Buffer.from((await call({ action: 'download', id })).data, 'base64');
}
export async function driveDelete(id) {
  try { await call({ action: 'delete', id }); } catch (e) { console.error('Gagal menghapus file di Google Drive:', e.message); }
}

// Memindahkan file ke folder ormas (dibuat/diganti namanya otomatis): "Ormas-001 - Nama Ormas"
export async function driveOrganize(kode, nama, ids) {
  return call({ action: 'organize', kode, nama, ids });
}
export async function driveDeleteFolder(kode) {
  try { await call({ action: 'delete_folder', kode }); } catch (e) { console.error('Gagal menghapus folder ormas di Google Drive:', e.message); }
}