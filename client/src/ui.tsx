import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, X, XCircle } from 'lucide-react';
import { api } from './api';
import { onLive } from './live';

export const DOC_STATUS = ['Lengkap', 'Belum Lengkap', 'Perlu Diverifikasi', 'Tidak Berlaku', 'Kedaluwarsa'];
const BADGE: Record<string, string> = {
  Lengkap: 'bg-green-100 text-green-800', 'Belum Lengkap': 'bg-orange-100 text-orange-800', 'Perlu Diverifikasi': 'bg-blue-100 text-blue-800',
  'Tidak Berlaku': 'bg-gray-200 text-gray-700', Kedaluwarsa: 'bg-red-100 text-red-800',
};
export const STATUS_COLOR: Record<string, string> = { Lengkap: '#16a34a', 'Belum Lengkap': '#f97316', 'Perlu Diverifikasi': '#2563eb', 'Tidak Berlaku': '#9ca3af', Kedaluwarsa: '#dc2626' };
export const Badge = ({ s }: { s: string }) => <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[s] || 'bg-slate-100 text-slate-700'}`}>{s}</span>;
export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) : '-');
export const fmtSize = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`card my-6 w-full ${wide ? 'max-w-3xl' : 'max-w-md'}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-serif text-lg font-bold text-navy-900">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const ToastCtx = createContext<(msg: string, ok?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<{ id: number; msg: string; ok: boolean }[]>([]);
  const push = useCallback((msg: string, ok = true) => {
    const id = Date.now() + Math.random(); setList((l) => [...l, { id, msg, ok }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex max-w-sm flex-col gap-2" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`flex items-start gap-2 rounded-md px-4 py-3 text-sm text-white shadow-lg ${t.ok ? 'bg-green-700' : 'bg-red-700'}`}>
            {t.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <XCircle size={18} className="mt-0.5 shrink-0" />}<span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useFetch<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let off = false; setLoading(true); setError('');
    api<T>(path).then((d) => !off && setData(d)).catch((e) => !off && setError(e.message)).finally(() => !off && setLoading(false));
    return () => { off = true; };
  }, [path, tick]);
  // Realtime: segarkan diam-diam (tanpa loading) saat server mengabarkan ada perubahan
  useEffect(() => { if (!path) return; return onLive(() => { api<T>(path).then((d) => setData((o) => (JSON.stringify(o) === JSON.stringify(d) ? o : d))).catch(() => {}); }); }, [path]);
  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}

export function useDebounced<T>(v: T, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export function Pager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total <= size) return null;
  return (
    <div className="flex items-center justify-between gap-2 pt-3 text-sm text-slate-600">
      <span>Halaman {page} dari {pages}</span>
      <div className="flex gap-2">
        <button className="btn-o" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={16} /> Sebelumnya</button>
        <button className="btn-o" disabled={page >= pages} onClick={() => onPage(page + 1)}>Berikutnya <ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export const Skeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="animate-pulse space-y-2 p-2">{Array.from({ length: rows }).map((_, i) => <div key={i} className="h-9 rounded bg-slate-200" />)}</div>
);
export const Empty = ({ text }: { text: string }) => <div className="py-12 text-center text-sm text-slate-500">{text}</div>;
export const ErrorBox = ({ text, retry }: { text: string; retry?: () => void }) => (
  <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{text} {retry && <button className="ml-2 font-semibold underline" onClick={retry}>Coba lagi</button>}</div>
);
export function Confirm({ title, text, onYes, onNo, danger }: { title: string; text: string; onYes: () => void; onNo: () => void; danger?: boolean }) {
  return (
    <Modal title={title} onClose={onNo}>
      <p className="text-sm text-slate-700">{text}</p>
      <div className="mt-5 flex justify-end gap-2"><button className="btn-o" onClick={onNo}>Batal</button><button className={danger ? 'btn-d' : 'btn-p'} onClick={onYes}>Ya, lanjutkan</button></div>
    </Modal>
  );
}
export const qs = (o: Record<string, any>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null) as any).toString();

export const DOC_TYPES: [string, string][] = [['sk_pengurusan', 'SK Pengurusan'], ['surat_domisili', 'Surat Keterangan Domisili'], ['program_kerja', 'Program Kerja'], ['badan_hukum', 'Salinan Badan Hukum'], ['skto', 'SKTO']];
export const KEMANTREN = ['Danurejan', 'Gedongtengen', 'Gondokusuman', 'Gondomanan', 'Jetis', 'Kotagede', 'Kraton', 'Mantrijeron', 'Mergangsan', 'Ngampilan', 'Pakualaman', 'Tegalrejo', 'Umbulharjo', 'Wirobrajan'];

// ---------- Tambahan: status validasi, dokumentasi, masa berlaku, Instagram ----------
export const VALIDASI = ['Terdata', 'Terdaftar', 'Teregister'];
export const DOKUMENTASI: [string, string] = ['dokumentasi', 'Laporan Kegiatan Tahunan'];
export const ANGGOTA_KEYS = ['anggota_total', 'anggota_perempuan', 'anggota_lansia', 'anggota_disabilitas'];
// Rincian anggota: hanya bagian yang terisi, mis. "50 perempuan · 10 lansia"
export const rincian = (o: any, short = false) => [['anggota_perempuan', 'perempuan', 'P'], ['anggota_lansia', 'lansia', 'L'], ['anggota_disabilitas', 'disabilitas', 'D']].filter(([k]) => o[k] != null && o[k] !== '').map(([k, l, s]) => (short ? `${s} ${nf(o[k])}` : `${nf(o[k])} ${l}`)).join(' · ');
export const nf = (n: any) => (n == null || n === '' ? '-' : Number(n).toLocaleString('id-ID'));
export const tglIndo = (iso?: string | null) => (iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }) : '-');

export const InstagramIcon = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
  </svg>
);

export interface Exp { status: string; tgl?: string; hari?: number }
// Peringatan masa berlaku SKTO / legal standing (dihitung server dari tanggal "Berlaku s/d")
export function ExpBadge({ e, full = false }: { e?: Exp; full?: boolean }) {
  if (!e || !e.tgl || e.hari == null) return null;
  const h = e.hari;
  if (e.status === 'kedaluwarsa') return <span className="mt-1 inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Sudah kedaluwarsa{full ? ` sejak ${tglIndo(e.tgl)}` : ''} ({-h} hari lalu)</span>;
  if (e.status === 'segera') return <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{h === 0 ? 'Berakhir hari ini' : h <= 60 ? `Segera berakhir: ${h} hari lagi` : `Berakhir ± ${Math.round(h / 30)} bulan lagi`}{full ? ` (${tglIndo(e.tgl)})` : ''}</span>;
  return null;
}

// Input "Berlaku s/d": pilih tanggal (tanggal, bulan, tahun). Isian teks lama tetap tampil sampai diganti.
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function BerlakuInput({ id, label, value, onChange, forever = false, span = false }: { id: string; label: string; value: string; onChange: (v: string) => void; forever?: boolean; span?: boolean }) {
  const isForever = /seumur\s*hidup/i.test(value || '');
  const legacy = !!value && !ISO.test(value) && !isForever;
  return (
    <div className={span ? 'md:col-span-2' : ''}>
      <label className="lbl" htmlFor={id}>{label}</label>
      {legacy ? (
        <div><input id={id} className="inp" value={value} onChange={(e) => onChange(e.target.value)} />
          <p className="mt-1 text-xs text-amber-700">Format lama. <button type="button" className="font-semibold underline" onClick={() => onChange('')}>Ganti dengan tanggal</button> agar pengingat kedaluwarsa akurat.</p></div>
      ) : (
        <>
          <input id={id} type="date" className="inp" value={ISO.test(value) ? value : ''} disabled={isForever} onChange={(e) => onChange(e.target.value)} />
          {forever && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" checked={isForever} onChange={(e) => onChange(e.target.checked ? 'Seumur hidup' : '')} />Seumur hidup / tanpa batas waktu</label>}
        </>
      )}
    </div>
  );
}

export const MEMBER_FIELDS: [string, string][] = [['anggota_total', 'Jumlah total anggota'], ['anggota_perempuan', 'Jumlah perempuan'], ['anggota_lansia', 'Jumlah lansia'], ['anggota_disabilitas', 'Jumlah disabilitas']];
// Isian jumlah anggota (angka saja)
export function MemberInputs({ f, set }: { f: any; set: (k: string, v: any) => void }) {
  return (
    <>
      {MEMBER_FIELDS.map(([k, l]) => (
        <div key={k}><label className="lbl" htmlFor={k}>{l}</label>
          <input id={k} type="number" min={0} max={9999999} step={1} inputMode="numeric" className="inp" placeholder="0" value={f[k] ?? ''} onChange={(e) => set(k, e.target.value.replace(/\D/g, ''))} /></div>
      ))}
      <p className="text-xs text-slate-500 md:col-span-2">Isi angka saja (tanpa nama anggota). Rincian perempuan, lansia, dan disabilitas boleh saling beririsan, jadi tidak harus berjumlah sama dengan total, tetapi tiap rincian tidak boleh lebih besar dari total.</p>
    </>
  );
}

// Tautan dokumentasi (mis. Google Drive) dan Instagram
export function LinkInputs({ f, set }: { f: any; set: (k: string, v: any) => void }) {
  return (
    <>
      <div className="md:col-span-2"><label className="lbl" htmlFor="link_dokumentasi">Link dokumentasi kegiatan (opsional) <span className="font-normal text-slate-500">mis. folder Google Drive</span></label>
        <input id="link_dokumentasi" type="url" className="inp" maxLength={500} placeholder="https://drive.google.com/..." value={f.link_dokumentasi ?? ''} onChange={(e) => set('link_dokumentasi', e.target.value)} /></div>
      <div className="md:col-span-2"><label className="lbl" htmlFor="link_instagram"><InstagramIcon size={14} className="mr-1 inline text-pink-600" />Instagram ormas (opsional) <span className="font-normal text-slate-500">tautan atau @username</span></label>
        <input id="link_instagram" className="inp" maxLength={200} placeholder="@namaormas atau https://instagram.com/namaormas" value={f.link_instagram ?? ''} onChange={(e) => set('link_instagram', e.target.value)} /></div>
    </>
  );
}
