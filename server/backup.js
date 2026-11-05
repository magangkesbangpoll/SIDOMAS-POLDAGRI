// Backup database SQLite ke Google Drive (folder BACKUP-DATABASE di dalam folder PDF)
import fs from 'fs';
import path from 'path';
import { db, DATA_DIR, getSetting, setSetting } from './db.js';
import { driveOn, driveUpload } from './drive.js';

export async function backupDb(force = false) {
  if (!driveOn()) return { skipped: 'Google Drive belum diaktifkan (GDRIVE_URL / GDRIVE_SECRET kosong)' };
  const last = getSetting('last_backup_at');
  if (!force && last && Date.now() - new Date(last).getTime() < 20 * 3600 * 1000) return { skipped: 'sudah ada backup dalam 20 jam terakhir' };
  const tmp = path.join(DATA_DIR, `backup-${Date.now()}.tmp`);
  try {
    await db.backup(tmp); // salinan yang konsisten walau aplikasi sedang dipakai
    const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' }).format(new Date()).replace(/[: ]/g, (c) => (c === ' ' ? '_' : '-'));
    const id = await driveUpload(tmp, `sidomas-${stamp}.db`, { kind: 'backup', mime: 'application/octet-stream' });
    setSetting('last_backup_at', new Date().toISOString());
    return { id };
  } finally {
    fs.rm(tmp, { force: true }, () => {});
  }
}
