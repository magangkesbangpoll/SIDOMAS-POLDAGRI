import React from 'react';
import { BerlakuInput } from './ui';

// ---------- Batch 4: Legal Standing ----------
export const LEGAL_PESAN_TIDAK = 'Anda Tidak Bisa Mengisi Karena Tidak Memiliki Legal Standing.';
export const LEGAL_FIELDS = ['legal_jenis', 'nomor_sk', 'legal_tahun', 'legal_berlaku_sd'];

// Data lama: ormas yang sudah punya data Legal Standing tetapi belum pernah menjawab pertanyaan YA/TIDAK
// diisi "YA" di formulir (tidak disimpan sampai pengguna menekan Simpan, dan masih bisa diubah).
export const initLegalStatus = (o: any) => {
  const s = String(o?.legal_status ?? '').toLowerCase();
  if (s === 'ya' || s === 'tidak') return s;
  return LEGAL_FIELDS.some((k) => String(o?.[k] ?? '').trim()) ? 'ya' : '';
};
export const legalText = (s?: string) => (s === 'ya' ? 'Sudah memiliki' : s === 'tidak' ? 'Belum memiliki' : 'Belum dikonfirmasi');
export const legalTone = (s?: string) => (s === 'ya' ? 'text-ok' : s === 'tidak' ? 'text-warn' : 'text-muted');

export const Chip = ({ tone = 'text-muted', children }: { tone?: string; children: React.ReactNode }) => <span className={`chip chip-dot ${tone}`}>{children}</span>;
export const LegalChip = ({ s }: { s?: string }) => <Chip tone={legalTone(s)}>{legalText(s)}</Chip>;

// Pertanyaan "Apakah sudah memiliki Legal Standing?" + isian yang hanya muncul jika jawabannya YA.
// Jika TIDAK: isian tidak ditampilkan (dikosongkan) dan muncul keterangan. Dipakai di form portal ormas, form admin, dan pendaftaran.
// Komponen ini dirender di dalam grid dua kolom, jadi anak-anaknya memakai md:col-span-2.
export function LegalStandingFields({ f, set, T }: { f: any; set: (k: string, v: any) => void; T: (k: string, label: string, o?: any) => React.ReactNode }) {
  const pilih = (v: string) => { set('legal_status', v); if (v === 'tidak') LEGAL_FIELDS.forEach((k) => set(k, '')); };
  return (
    <>
      <fieldset className="panel md:col-span-2">
        <legend className="px-1 text-sm font-semibold">Apakah sudah memiliki Legal Standing?</legend>
        <div className="flex flex-wrap gap-6 pt-1">
          {[['ya', 'YA'], ['tidak', 'TIDAK']].map(([v, l]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="radio" name="legal_status" value={v} checked={f.legal_status === v} onChange={() => pilih(v)} />{l}</label>
          ))}
        </div>
      </fieldset>
      {f.legal_status === 'ya' && (
        <>
          {T('legal_jenis', 'Jenis Legal Standing', { list: 'dl-legal', ph: 'Mis. Akta Notaris' })}
          {T('nomor_sk', 'Nomor Legal Standing')}
          {T('legal_tahun', 'Tahun', { max: 4, ph: '2021' })}
          <BerlakuInput id="legal_berlaku_sd" label="Berlaku Sampai" forever value={f.legal_berlaku_sd ?? ''} onChange={(v: string) => set('legal_berlaku_sd', v)} />
          <datalist id="dl-legal"><option value="Akta Notaris" /><option value="SK Kemenkumham" /></datalist>
        </>
      )}
      {f.legal_status === 'tidak' && <p className="note-warn md:col-span-2" role="status">{LEGAL_PESAN_TIDAK}</p>}
      {!f.legal_status && <p className="note-info md:col-span-2 !text-xs">Pilih YA atau TIDAK. Jika YA, isian jenis, nomor, tahun, dan masa berlaku akan muncul. Jika TIDAK, Anda tidak perlu mengisi data dokumen yang memang tidak dimiliki.</p>}
    </>
  );
}

// ---------- Batch 6: dashboard ormas ----------
export const NOTIF_TONE: Record<string, string> = { Information: 'text-info', Warning: 'text-warn', 'Required Action': 'text-bad' };
export const DOK_TONE: Record<string, string> = { Aktif: 'text-ok', 'Akan Berakhir': 'text-info', 'Segera Diperbarui': 'text-warn', Kedaluwarsa: 'text-bad', 'Belum Memiliki Data': 'text-muted' };

// ---------- Batch 7: laporan tahunan ----------
export const LAP_TEXT: Record<string, string> = { belum: 'Belum dibuat', draft: 'Draf', dikirim: 'Sudah dikirim', revisi: 'Perlu revisi' };
export const LAP_TONE: Record<string, string> = { belum: 'text-muted', draft: 'text-warn', dikirim: 'text-ok', revisi: 'text-bad' };
export const rupiah = (n: any) => (n == null || n === '' ? '-' : 'Rp ' + Number(n).toLocaleString('id-ID'));
