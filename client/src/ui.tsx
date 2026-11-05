import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, X, XCircle } from 'lucide-react';
import { api } from './api';

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
