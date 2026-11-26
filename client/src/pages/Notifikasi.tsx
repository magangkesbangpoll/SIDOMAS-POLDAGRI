import { onLive } from '../live';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, BellRing, CheckCheck, Smartphone } from 'lucide-react';
import { api } from '../api';
import { Empty, ErrorBox, Skeleton, fmtDate, tglIndo, useFetch, useToast } from '../ui';

// ---------- Notifikasi HP (Web Push) ----------
const b64ToBytes = (s: string) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export function PushToggle() {
  const toast = useToast();
  const [state, setState] = useState<'cek' | 'tidak_didukung' | 'ditolak' | 'mati' | 'hidup'>('cek'); const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    if (!pushSupported()) return setState('tidak_didukung');
    if (Notification.permission === 'denied') return setState('ditolak');
    try { const reg = await navigator.serviceWorker.ready; setState((await reg.pushManager.getSubscription()) ? 'hidup' : 'mati'); } catch { setState('mati'); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const on = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState(perm === 'denied' ? 'ditolak' : 'mati'); return; }
      const { key } = await api('/admin/push/key');
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
      await api('/admin/push/subscribe', { body: sub.toJSON() });
      setState('hidup'); toast('Notifikasi HP diaktifkan di perangkat ini');
    } catch (e: any) { toast(e.message || 'Gagal mengaktifkan notifikasi', false); } finally { setBusy(false); }
  };
  const off = async () => {
    setBusy(true);
    try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) { await api('/admin/push/unsubscribe', { body: { endpoint: sub.endpoint } }); await sub.unsubscribe(); } setState('mati'); toast('Notifikasi HP dimatikan di perangkat ini'); }
    catch (e: any) { toast(e.message, false); } finally { setBusy(false); }
  };
  const test = async () => { try { await api('/admin/push/test', { method: 'POST', body: {} }); toast('Uji coba dikirim, cek notifikasi di HP/komputer Anda'); } catch (e: any) { toast(e.message, false); } };
  return (
    <div className="panel text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-ink"><Smartphone size={16} /> Notifikasi di HP / perangkat ini</p>
        {state === 'mati' && <button className="btn-p py-1" disabled={busy} onClick={on}><BellRing size={15} /> Aktifkan</button>}
        {state === 'hidup' && <span className="flex gap-2"><button className="btn-o py-1" onClick={test}>Kirim uji coba</button><button className="btn-o py-1" disabled={busy} onClick={off}>Matikan</button></span>}
      </div>
      <p className="mt-1 text-xs text-muted">
        {state === 'cek' && 'Memeriksa…'}
        {state === 'mati' && 'Aktifkan agar HP berbunyi setiap ada perubahan oleh admin lain atau ormas.'}
        {state === 'hidup' && 'Aktif. Perangkat ini akan menerima notifikasi setiap ada perubahan.'}
        {state === 'ditolak' && 'Izin notifikasi diblokir di browser. Buka pengaturan situs di browser, ubah Notifikasi menjadi "Izinkan", lalu muat ulang halaman.'}
        {state === 'tidak_didukung' && 'Browser ini belum mendukung notifikasi. Di iPhone: buka lewat Safari, pilih Bagikan > "Tambahkan ke Layar Utama", lalu buka aplikasinya dari layar utama. Notifikasi juga butuh alamat HTTPS (bukan localhost dari HP lain).'}
      </p>
    </div>
  );
}

// ---------- Lonceng di header ----------
export function NotifBell() {
  const nav = useNavigate(); const [unread, setUnread] = useState(0); const [open, setOpen] = useState(false); const [items, setItems] = useState<any[] | null>(null); const ref = useRef<HTMLDivElement>(null);
  const loadCount = useCallback(() => api('/admin/notifikasi/unread').then((d) => setUnread(d.unread)).catch(() => {}), []);
  const loadList = useCallback(() => api('/admin/notifikasi').then((d) => { setItems(d.items); setUnread(d.unread); }).catch(() => {}), []);
  useEffect(() => { loadCount(); const t = setInterval(loadCount, 15000); const v = () => document.visibilityState === 'visible' && loadCount(); document.addEventListener('visibilitychange', v); return () => { clearInterval(t); document.removeEventListener('visibilitychange', v); }; }, [loadCount]);
  useEffect(() => { if (open) loadList(); }, [open, loadList]);
  useEffect(() => onLive(() => { loadCount(); if (open) loadList(); }), [loadCount, loadList, open]);
  useEffect(() => { const h = (e: MouseEvent) => { if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [open]);
  const readAll = async () => { await api('/admin/notifikasi/read-all', { method: 'POST', body: {} }).catch(() => {}); loadList(); };
  const go = async (n: any) => {
    if (!n.dibaca) { await api(`/admin/notifikasi/${n.id}/read`, { method: 'POST', body: {} }).catch(() => {}); loadList(); }
    setOpen(false);
    nav(n.jenis === 'kedaluwarsa' ? '/admin/kedaluwarsa' : n.ormas_id ? `/admin/ormas?detail=${n.ormas_id}` : '/admin/notifikasi');
  };
  return (
    <div className="relative" ref={ref}>
      <button className="icon-btn relative" aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'} onClick={() => setOpen(!open)}>
        <Bell size={18} />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface" aria-hidden="true">{unread > 9 ? '9+' : ''}</span>}
      </button>
      {open && (
        <div className="popover fixed inset-x-3 top-[4.75rem] z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-96">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <h3 className="font-bold text-ink">Notifikasi</h3>
            <button className="btn-o py-1 text-xs" disabled={!unread} onClick={readAll}><CheckCheck size={14} /> Sudah dibaca</button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {!items ? <Skeleton rows={3} /> : !items.length ? <Empty text="Belum ada notifikasi." /> : (
              <ul className="divide-y divide-line">{items.slice(0, 12).map((n) => <Row key={n.id} n={n} onClick={() => go(n)} />)}</ul>
            )}
          </div>
          <div className="border-t border-line px-3 py-2 text-center"><Link className="text-sm font-semibold text-link hover:underline" to="/admin/notifikasi" onClick={() => setOpen(false)}>Lihat semua notifikasi</Link></div>
        </div>
      )}
    </div>
  );
}

function Row({ n, onClick }: { n: any; onClick: () => void }) {
  return (
    <li>
      <button className={`flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-soft/60 ${n.dibaca ? '' : 'bg-info/10'}`} onClick={onClick}>
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.dibaca ? 'bg-soft' : 'bg-bad'}`} aria-label={n.dibaca ? 'Sudah dibaca' : 'Belum dibaca'} />
        <span className="min-w-0 flex-1 text-sm">
          <b className="block text-ink [overflow-wrap:anywhere]">{n.judul}</b>
          <span className="mt-0.5 block text-muted [overflow-wrap:anywhere]">{n.pesan}</span>
          <span className="mt-0.5 block text-xs text-muted/80">{fmtDate(n.created_at)}</span>
        </span>
      </button>
    </li>
  );
}

// ---------- Halaman Notifikasi ----------
export function NotifPage() {
  const nav = useNavigate(); const toast = useToast();
  const { data, loading, error, reload } = useFetch<any>('/admin/notifikasi');
  const readAll = async () => { try { await api('/admin/notifikasi/read-all', { method: 'POST', body: {} }); toast('Semua notifikasi ditandai sudah dibaca'); reload(); } catch (e: any) { toast(e.message, false); } };
  const go = async (n: any) => { if (!n.dibaca) await api(`/admin/notifikasi/${n.id}/read`, { method: 'POST', body: {} }).catch(() => {}); nav(n.jenis === 'kedaluwarsa' ? '/admin/kedaluwarsa' : n.ormas_id ? `/admin/ormas?detail=${n.ormas_id}` : '/admin/notifikasi'); };
  return (
    <div className="stagger space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="eyebrow">Pusat pemberitahuan</p><h1 className="page-title">Notifikasi Admin</h1></div><button className="btn-o" disabled={!data?.unread} onClick={readAll}><CheckCheck size={16} /> Sudah dibaca semua{data?.unread ? ` (${data.unread})` : ''}</button></div>
      <PushToggle />
      <div className="card">
        {error ? <div className="p-4"><ErrorBox text={error} retry={reload} /></div> : loading && !data ? <Skeleton /> : !data?.items.length ? <Empty text="Belum ada notifikasi. Perubahan oleh admin atau ormas akan muncul di sini." /> : <ul className="divide-y divide-line">{data.items.map((n: any) => <Row key={n.id} n={n} onClick={() => go(n)} />)}</ul>}
      </div>
    </div>
  );
}

// ---------- Halaman Dokumen Kedaluwarsa ----------
export function ExpiredPage() {
  const nav = useNavigate(); const [hari, setHari] = useState(90); const [jenis, setJenis] = useState('');
  const { data, loading, error, reload } = useFetch<any>(`/admin/kedaluwarsa?hari=${hari}`);
  const rows = (data?.items || []).filter((i: any) => !jenis || i.jenis === jenis);
  const sudah = rows.filter((i: any) => i.hari < 0), segera = rows.filter((i: any) => i.hari >= 0);
  const Tabel = ({ title, list, tone }: { title: string; list: any[]; tone: string }) => (
    <div className="card-solid overflow-x-auto">
      <h2 className={`border-b border-line px-4 py-3 text-sm font-bold ${tone}`}>{title} ({list.length})</h2>
      {!list.length ? <Empty text="Tidak ada." /> : (
        <table className="tbl"><thead><tr>{['ID Ormas', 'Nama Ormas', 'Dokumen', 'Nomor', 'Berlaku s/d', 'Sisa waktu', 'Aksi'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{list.map((i) => (
            <tr key={i.id + i.jenis}><td data-label="ID Ormas" className="td font-semibold"><div>{i.kode_ormas}</div></td><td data-label="Nama Ormas" className="td min-w-[200px]"><div>{i.nama_ormas}<div className="text-xs text-muted">{i.nama_kategori}{i.status_operasional === 'Tidak Aktif' ? ' · Tidak aktif' : ''}</div></div></td>
              <td data-label="Dokumen" className="td"><div>{i.jenis}</div></td><td data-label="Nomor" className="td text-xs"><div>{i.nomor || '-'}</div></td><td data-label="Berlaku s/d" className="td whitespace-nowrap"><div>{tglIndo(i.berlaku_sd)}</div></td>
              <td data-label="Sisa waktu" className="td whitespace-nowrap"><div>{i.hari < 0 ? <span className="font-semibold text-bad">Lewat {-i.hari} hari</span> : i.hari === 0 ? <span className="font-semibold text-bad">Berakhir hari ini</span> : <span className="font-semibold text-warn">{i.hari} hari lagi</span>}</div></td>
              <td data-label="Aksi" className="td"><div><button className="btn-o py-1" onClick={() => nav(`/admin/ormas?detail=${i.id}`)}>Buka</button></div></td></tr>))}</tbody></table>)}
    </div>
  );
  return (
    <div className="stagger space-y-4">
      <div><p className="eyebrow">Masa berlaku</p><h1 className="page-title">Dokumen Kedaluwarsa</h1><p className="text-sm text-muted">Dihitung otomatis dari tanggal "Berlaku s/d" pada SKTO dan Legal Standing setiap ormas (acuan: tanggal hari ini, zona WIB).</p></div>
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <label className="text-sm font-semibold text-body" htmlFor="hr">Tampilkan yang berakhir dalam</label>
        <select id="hr" className="inp w-auto" value={hari} onChange={(e) => setHari(+e.target.value)}>{[30, 60, 90, 180, 365].map((h) => <option key={h} value={h}>{h} hari ke depan</option>)}</select>
        <select className="inp w-auto" aria-label="Jenis dokumen" value={jenis} onChange={(e) => setJenis(e.target.value)}><option value="">SKTO dan Legal Standing</option><option>SKTO</option><option>Legal Standing</option></select>
      </div>
      {error ? <ErrorBox text={error} retry={reload} /> : loading && !data ? <Skeleton /> : (
        <>
          <Tabel title="Sudah kedaluwarsa" list={sudah} tone="!text-bad bg-bad/10" />
          <Tabel title={`Akan kedaluwarsa dalam ${hari} hari`} list={segera} tone="!text-warn bg-warn/10" />
          {data?.tidak_terbaca?.length > 0 && (
            <div className="card p-4 text-sm"><h2 className="mb-1 flex items-center gap-2 font-bold text-ink"><AlertTriangle size={16} className="text-warn" />Tanggal berlaku tidak terbaca ({data.tidak_terbaca.length})</h2>
              <p className="mb-2 text-xs text-muted">Isian "Berlaku s/d" berikut bukan tanggal yang dikenali, sehingga tidak bisa dihitung. Edit ormasnya dan pilih tanggal yang pasti.</p>
              <ul className="divide-y divide-line">{data.tidak_terbaca.map((t: any) => <li key={t.id + t.jenis} className="flex flex-wrap justify-between gap-2 py-1.5"><span><b>{t.kode_ormas}</b> {t.nama_ormas} · {t.jenis}: "{t.nilai}"</span><button className="text-link underline" onClick={() => nav(`/admin/ormas?detail=${t.id}`)}>Buka</button></li>)}</ul></div>
          )}
        </>
      )}
    </div>
  );
}
