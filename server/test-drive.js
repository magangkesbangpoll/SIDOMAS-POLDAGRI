// Uji koneksi Google Drive: buat SATU folder ormas uji, unggah PDF + logo ke folder yang sama, unduh kembali, bandingkan, lalu hapus.
// Jalankan: node server/test-drive.js
import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { driveOn, driveUpload, driveEnsureFolder, driveDownload, driveDelete, driveDeleteFolder } from './drive.js';

if (!driveOn()) {
  console.error('\nGAGAL: GDRIVE_URL dan/atau GDRIVE_SECRET belum diisi di file .env.\n');
  process.exit(1);
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const cases = [
  { label: 'PDF  -> folder PDF', kind: 'pdf', mime: 'application/pdf', name: 'TES-SIDOMAS.pdf', data: Buffer.from('%PDF-1.4\n% tes ' + Date.now() + '\n%%EOF') },
  { label: 'Logo -> folder Logo', kind: 'logo', mime: 'image/png', name: 'TES-SIDOMAS.png', data: png },
];
const ids = [];
const kodeUji = 'Ormas-999';
let folder = null;
try {
  folder = await driveEnsureFolder(kodeUji, 'TES-SIDOMAS');
  console.log(`\nFolder uji: ${folder.nama} (satu folder untuk PDF + logo: ${folder.folder || folder.pdf})`);
  for (const c of cases) {
    const tmp = path.join(os.tmpdir(), 'sidomas-tes-' + c.kind);
    fs.writeFileSync(tmp, c.data);
    console.log(`\n${c.label}: mengunggah ke folder ormas uji ...`);
    const id = await driveUpload(tmp, c.name, { kind: c.kind, mime: c.mime, kode: kodeUji, nama: 'TES-SIDOMAS', parent: c.kind === 'logo' ? folder.logo : folder.pdf });
    ids.push(id);
    fs.rmSync(tmp, { force: true });
    const back = await driveDownload(id);
    if (!back.equals(c.data)) throw new Error(`Isi file ${c.kind} yang diunduh berbeda dari yang diunggah`);
    console.log('   BERHASIL (diunggah di folder ormas, diunduh kembali, isi sama persis)');
  }
  console.log('\nMenghapus file uji (dipindah ke Sampah Drive) ...');
  for (const id of ids) await driveDelete(id);
  await driveDeleteFolder(kodeUji);
  console.log('\nSEMUA BERHASIL. Setiap ormas akan mendapat folder sendiri di Google Drive.\n');
} catch (e) {
  console.error(`\nGAGAL: ${e.message}\n`);
  for (const id of ids) await driveDelete(id);
  if (folder?.baru) await driveDeleteFolder(kodeUji);
  process.exit(1);
}
