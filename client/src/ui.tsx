import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, Inbox, TriangleAlert, X, XCircle } from 'lucide-react';
import { api } from './api';
import { onLive } from './live';

export const DOC_STATUS = ['Lengkap', 'Belum Lengkap', 'Perlu Diverifikasi', 'Tidak Berlaku', 'Kedaluwarsa'];
const BADGE: Record<string, string> = {
  Lengkap: 'text-ok', 'Belum Lengkap': 'text-warn', 'Perlu Diverifikasi': 'text-info',
  'Tidak Berlaku': 'text-muted', Kedaluwarsa: 'text-bad',
};
export const STATUS_COLOR: Record<string, string> = { Lengkap: '#4FAF8B', 'Belum Lengkap': '#D6A04A', 'Perlu Diverifikasi': '#6A93CC', 'Tidak Berlaku': '#8895AA', Kedaluwarsa: '#C86A6E' };
// `label` hanya mengganti teks yang tampil; warna tetap mengikuti status `s`
export const Badge = ({ s, label }: { s: string; label?: string }) => <span className={`chip chip-dot ${BADGE[s] || 'text-muted'}`}>{label || s}</span>;
export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) : '-');
export const fmtSize = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

// Tumpukan dialog terbuka: tombol Escape hanya menutup yang paling atas, scroll halaman dikunci selama ada dialog.
const stack: symbol[] = [];
export function Modal({ title, onClose, children, wide, drawer }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; drawer?: boolean }) {
  const id = useRef(Symbol()); const box = useRef<HTMLDivElement>(null); const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const me = id.current; const before = document.activeElement as HTMLElement | null;
    stack.push(me); document.body.style.overflow = 'hidden';
    if (!box.current?.contains(document.activeElement)) box.current?.focus({ preventScroll: true });
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && stack[stack.length - 1] === me) close.current(); };
    window.addEventListener('keydown', h);
    return () => { window.removeEventListener('keydown', h); stack.splice(stack.indexOf(me), 1); if (!stack.length) document.body.style.overflow = ''; before?.focus?.({ preventScroll: true }); };
  }, []);
  const head = (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3.5">
      <h2 className="text-base font-bold">{title}</h2>
      <button type="button" onClick={onClose} aria-label="Tutup" className="icon-btn"><X size={17} /></button>
    </div>
  );
  return createPortal(
    <div className={`overlay fixed inset-0 z-50 flex ${drawer ? 'justify-end' : 'items-start justify-center overflow-y-auto p-3 sm:p-6'}`} role="dialog" aria-modal="true" aria-label={title}
      onMouseDown={drawer ? (e) => e.target === e.currentTarget && onClose() : undefined}>
      <div ref={box} tabIndex={-1} className={drawer ? 'drawer outline-none' : `dialog my-auto outline-none ${wide ? 'max-w-3xl' : 'max-w-md'}`}>
        {head}
        <div className={drawer ? 'min-h-0 flex-1 overflow-y-auto p-5' : 'p-5'}>{children}</div>
      </div>
    </div>, document.body);
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
      {createPortal(
        <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:max-w-sm" aria-live="polite">
          {list.map((t) => (
            <div key={t.id} className="toast pointer-events-auto">
              {t.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#6ECDA6]" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-[#E88A8A]" />}<span>{t.msg}</span>
            </div>
          ))}
        </div>, document.body)}
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
    <nav className="flex flex-wrap items-center justify-between gap-2 pt-3 text-sm text-muted" aria-label="Halaman">
      <span>Halaman <b className="text-ink">{page}</b> dari {pages}</span>
      <div className="flex gap-2">
        <button className="btn-o" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={16} /> Sebelumnya</button>
        <button className="btn-o" disabled={page >= pages} onClick={() => onPage(page + 1)}>Berikutnya <ChevronRight size={16} /></button>
      </div>
    </nav>
  );
}

export const Skeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2.5 p-3" role="status" aria-label="Memuat">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skel h-10" />)}</div>
);
export const Spinner = () => <span className="spinner" aria-hidden="true" />;
export const Loading = () => <div className="grid min-h-screen place-items-center text-muted"><span className="flex items-center gap-3 text-sm"><Spinner /> Memuat…</span></div>;
export const Empty = ({ text }: { text: string }) => (
  <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-sm text-muted"><span className="grid h-11 w-11 place-items-center rounded-full border border-line text-gold"><Inbox size={19} /></span><p className="max-w-sm">{text}</p></div>
);
export const ErrorBox = ({ text, retry }: { text: string; retry?: () => void }) => (
  <div className="note-bad flex items-start gap-2" role="alert"><TriangleAlert size={17} className="mt-0.5 shrink-0 text-bad" /><span>{text} {retry && <button className="ml-2 font-semibold underline" onClick={retry}>Coba lagi</button>}</span></div>
);
export function Confirm({ title, text, onYes, onNo, danger }: { title: string; text: string; onYes: () => void; onNo: () => void; danger?: boolean }) {
  return (
    <Modal title={title} onClose={onNo}>
      <p className="text-sm leading-relaxed">{text}</p>
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
export const ADART: [string, string] = ['adart', 'AD/ART'];
export const COMPANY_PROFILE: [string, string] = ['company_profile', 'Company Profile'];
export const docAccept = (j: string) => (j === 'company_profile' ? '.pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/pdf');
export const docTypeOk = (j: string, x: File) => (j === 'company_profile' ? /\.(pdf|pptx?)$/i.test(x.name) : x.type === 'application/pdf');
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
  if (e.status === 'kedaluwarsa') return <span className="chip mt-1 !whitespace-normal text-bad">Sudah kedaluwarsa{full ? ` sejak ${tglIndo(e.tgl)}` : ''} ({-h} hari lalu)</span>;
  if (e.status === 'segera') return <span className="chip mt-1 !whitespace-normal text-warn">{h === 0 ? 'Berakhir hari ini' : h <= 60 ? `Segera berakhir: ${h} hari lagi` : `Berakhir ± ${Math.round(h / 30)} bulan lagi`}{full ? ` (${tglIndo(e.tgl)})` : ''}</span>;
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
          <p className="mt-1 text-xs text-warn">Format lama. <button type="button" className="font-semibold underline" onClick={() => onChange('')}>Ganti dengan tanggal</button> agar pengingat kedaluwarsa akurat.</p></div>
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
      <p className="text-xs text-muted md:col-span-2">Isi angka saja (tanpa nama anggota). Rincian perempuan, lansia, dan disabilitas boleh saling beririsan, jadi tidak harus berjumlah sama dengan total, tetapi tiap rincian tidak boleh lebih besar dari total.</p>
    </>
  );
}

// Tautan dokumentasi (mis. Google Drive) dan Instagram
export function LinkInputs({ f, set }: { f: any; set: (k: string, v: any) => void }) {
  return (
    <>
      <div className="md:col-span-2"><label className="lbl" htmlFor="link_dokumentasi">Link dokumentasi kegiatan (opsional) <span className="font-normal text-muted">mis. folder Google Drive</span></label>
        <input id="link_dokumentasi" type="url" className="inp" maxLength={500} placeholder="https://drive.google.com/..." value={f.link_dokumentasi ?? ''} onChange={(e) => set('link_dokumentasi', e.target.value)} /></div>
      <div className="md:col-span-2"><label className="lbl" htmlFor="link_instagram"><InstagramIcon size={14} className="mr-1 inline text-bad" />Instagram ormas (opsional) <span className="font-normal text-muted">tautan atau @username</span></label>
        <input id="link_instagram" className="inp" maxLength={200} placeholder="@namaormas atau https://instagram.com/namaormas" value={f.link_instagram ?? ''} onChange={(e) => set('link_instagram', e.target.value)} /></div>
      <div className="md:col-span-2"><label className="lbl" htmlFor="link_youtube">Link YouTube ormas (opsional)</label>
        <input id="link_youtube" type="url" className="inp" maxLength={200} placeholder="https://youtube.com/@namaormas" value={f.link_youtube ?? ''} onChange={(e) => set('link_youtube', e.target.value)} /></div>
      <div className="md:col-span-2"><label className="lbl" htmlFor="link_tiktok">Link TikTok ormas (opsional)</label>
        <input id="link_tiktok" type="url" className="inp" maxLength={200} placeholder="https://tiktok.com/@namaormas" value={f.link_tiktok ?? ''} onChange={(e) => set('link_tiktok', e.target.value)} /></div>
    </>
  );
}

// ---------- Company Profile: panduan isi + status kelengkapan ----------
export const CP_PARTS: [string, string][] = [['deskripsi', 'Deskripsi singkat ormas'], ['visi', 'Visi'], ['misi', 'Misi'], ['legal', 'Legal Standing'], ['bidang', 'Cakupan kegiatan / bidang'], ['dana', 'Sumber dana'], ['anggota', 'Profil anggota (kelompok perempuan, lansia, dan disabilitas)'], ['pengurus', 'Susunan pengurus'], ['program', 'Program kegiatan']];
export function CompanyProfileGuide({ compact = false }: { compact?: boolean }) {
  return (
    <div className="note-info md:col-span-2">
      <p className="font-semibold">Panduan pengisian Company Profile</p>
      <p className="mt-0.5 text-xs">Company Profile (PDF / PPT / PPTX) wajib memuat bagian berikut:</p>
      <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs">{CP_PARTS.map(([k, l]) => <li key={k}>{l}</li>)}</ol>
      {!compact && <p className="mt-2 text-xs">Company Profile tampil terbuka untuk umum di katalog (tanpa username dan password). Ormas dapat memperbarui Company Profile kapan saja lewat halaman ormas setelah login. Pembaruan diperiksa admin lebih dulu sebelum tampil di katalog.</p>}
    </div>
  );
}
export function CpChecklist({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const sel = new Set(String(value || '').split(',').filter(Boolean));
  const toggle = (k: string) => { const n = new Set(sel); if (n.has(k)) n.delete(k); else n.add(k); onChange(CP_PARTS.map(([x]) => x).filter((x) => n.has(x)).join(',')); };
  return (
    <fieldset className="panel md:col-span-2">
      <legend className="px-1 text-sm font-semibold">Bagian yang sudah ada di Company Profile Anda <span className="chip ml-1 !text-[10px] uppercase text-muted">Opsional</span></legend>
      <div className="grid gap-1 sm:grid-cols-2">{CP_PARTS.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sel.has(k)} onChange={() => toggle(k)} />{l}</label>)}</div>
      <p className="mt-1 text-xs text-muted">Centang bagian yang sudah dimuat di berkas Company Profile. Centang ini menentukan status kelengkapan.</p>
    </fieldset>
  );
}
export function cpStatus(cpBagian: string, hasFile: boolean) {
  const sel = new Set(String(cpBagian || '').split(',').filter(Boolean));
  const missing = CP_PARTS.filter(([k]) => !sel.has(k)).map(([, l]) => l);
  return { done: CP_PARTS.length - missing.length, total: CP_PARTS.length, missing, hasFile, lengkap: hasFile && !missing.length };
}
export function CpStatus({ cpBagian, hasFile }: { cpBagian: string; hasFile: boolean }) {
  const s = cpStatus(cpBagian, hasFile);
  return (
    <div className="text-xs">
      <span className={`chip chip-dot ${s.lengkap ? 'text-ok' : s.hasFile ? 'text-warn' : 'text-bad'}`}>{!s.hasFile ? 'Belum diunggah' : s.lengkap ? `Lengkap (${s.done}/${s.total} bagian)` : `Belum lengkap (${s.done}/${s.total} bagian)`}</span>
      {s.hasFile && s.missing.length > 0 && <p className="mt-1 text-warn">Belum diisi: {s.missing.join(', ')}</p>}
    </div>
  );
}
