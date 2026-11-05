// Uji koneksi Google Drive: unggah PDF, logo, dan backup uji, unduh kembali, bandingkan, lalu hapus.
// Jalankan: node server/test-drive.js
import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { driveOn, driveUpload, driveDownload, driveDelete } from './drive.js';

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
try {
  for (const c of cases) {
    const tmp = path.join(os.tmpdir(), 'sidomas-tes-' + c.kind);
    fs.writeFileSync(tmp, c.data);
    console.log(`\n${c.label}: mengunggah ...`);
    const id = await driveUpload(tmp, c.name, { kind: c.kind, mime: c.mime });
    ids.push(id);
    fs.rmSync(tmp, { force: true });
    const back = await driveDownload(id);
    if (!back.equals(c.data)) throw new Error(`Isi file ${c.kind} yang diunduh berbeda dari yang diunggah`);
    console.log('   BERHASIL (diunggah dan diunduh kembali, isi sama persis)');
  }
  console.log('\nMenghapus file uji (dipindah ke Sampah Drive) ...');
  for (const id of ids) await driveDelete(id);
  console.log('\nSEMUA BERHASIL. Penyimpanan PDF dan logo di Google Drive siap dipakai.\n');
} catch (e) {
  console.error(`\nGAGAL: ${e.message}\n`);
  for (const id of ids) await driveDelete(id);
  process.exit(1);
}
