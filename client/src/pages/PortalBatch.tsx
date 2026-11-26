import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowRight, Building2, ClipboardList, Download, ExternalLink, FileText, KeyRound, LayoutDashboard, LogOut, MapPin, Moon, Pencil, Save, Send, ShieldCheck, Sun, TriangleAlert, Users } from 'lucide-react';
import { api } from '../api';
import { Badge, Confirm, Empty, ErrorBox, Loading, Modal, Skeleton, Spinner, fmtDate, fmtSize, useFetch, useToast } from '../ui';
import { ChangePassword, PasswordInput } from './AdminAuth';
import { useTheme } from '../theme';
import { Chip, DOK_TONE, LAP_TEXT, LAP_TONE, NOTIF_TONE, legalText, legalTone, rupiah } from '../batchui';

// ============ Kerangka portal ormas (header, menu, identitas ormas) ============
// Halaman anak (/portal, /portal/data, /portal/laporan) memakai data dari useOutletContext: { me, reload, dash }.
export function PortalLayout() {
  const nav = useNavigate(); const [theme, toggleTheme] = useTheme();
  const [me, setMe] = useState<any>(null); const [err, setErr] = useState(''); const [pw, setPw] = useState(false);
  const dash = useFetch<any>('/portal/dashboard'); // dipakai bersama: dashboard + lencana notifikasi (otomatis segar lewat realtime)
  const load = () => api('/portal/me').then(setMe).catch((e) => (e.status === 401 ? nav('/ormas-login', { replace: true }) : setErr(e.message)));
  const refresh = () => { load(); dash.reload(); };
  useEffect(() => { load(); }, []);
  if (err) return <div className="p-6"><ErrorBox text={err} retry={refresh} /></div>;
  if (!me) return <Loading />;
  if (me.must_change) return <ChangePassword path="/portal/change-password" onDone={refresh} />;
  const logout = async () => { await api('/portal/logout', { method: 'POST', body: {} }).catch(() => {}); nav('/ormas-login'); };
  const unread = dash.data?.notifikasi?.unread || 0;
  const tabs: [string, string, any][] = [['/portal', 'Dashboard', LayoutDashboard], ['/portal/data', 'Data Ormas', Pencil], ['/portal/laporan', 'Laporan Tahunan', ClipboardList]];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 px-3 pt-3">
        <div className="topbar mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 rounded-2xl px-3 py-2.5">
          <Link to="/" className="flex items-center gap-2.5"><span className="brand-mark h-9 w-9"><Building2 size={18} /></span><span><span className="block text-sm font-extrabold leading-tight tracking-wide text-ink">SIDOMAS</span><span className="eyebrow block !text-[10px]">Portal Ormas</span></span></Link>
          <div className="flex gap-2">
            <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Pakai tema terang' : 'Pakai tema gelap'} title={theme === 'dark' ? 'Tema terang' : 'Tema gelap'}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
            <button className="btn-o" onClick={() => setPw(true)} aria-label="Ganti password"><KeyRound size={15} /> <span className="hidden sm:inline">Ganti password</span></button>
            <button className="btn-o" onClick={logout} aria-label="Keluar"><LogOut size={15} /> <span className="hidden sm:inline">Keluar</span></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-4 px-3 py-5 sm:px-4">
        <nav aria-label="Menu portal" className="flex flex-wrap gap-2">
          {tabs.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/portal'} className={({ isActive }) => (isActive ? 'btn-p' : 'btn-o')}>
              <Icon size={15} /> {label}{to === '/portal' && unread > 0 && <span className="ml-1 rounded-full bg-gold px-1.5 text-[10.5px] font-bold leading-5 text-navy-night" aria-label={`${unread} notifikasi belum dibaca`}>{unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="card flex flex-wrap items-center gap-4 p-4">
          {me.has_logo ? <img src={`/api/logo/${me.kode_ormas}?${me.logo_pending ? 'pending=1&' : ''}v=${encodeURIComponent(me.updated_at)}`} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <span className="brand-mark h-16 w-16 !rounded-2xl"><Building2 /></span>}
          <div className="min-w-0 flex-1"><p className="eyebrow">{me.kode_ormas} · {me.nama_kategori}</p><h1 className="text-xl font-bold text-ink">{me.nama_ormas}</h1><div className="mt-1 flex flex-wrap items-center gap-2 text-xs"><Badge s={me.status_dokumen} /><span className="text-muted">Diperbarui {fmtDate(me.updated_at)}</span></div></div>
        </div>
        {me.pending && <p className="note-info"><b>Perubahan Anda menunggu verifikasi admin.</b> Katalog publik dan penyimpanan dokumen masih memakai data lama sampai admin memverifikasinya. Anda masih bisa menyunting dan menyimpan ulang perubahan ini.</p>}
        {!me.pending && me.catatan_penolakan && <p className="note-bad"><b>Perubahan terakhir Anda ditolak admin.</b> {me.catatan_penolakan}</p>}
        <Outlet context={{ me, reload: refresh, dash }} />
      </main>
      {pw && <PwModal onClose={() => setPw(false)} />}
    </div>
  );
}

function PwModal({ onClose }: { onClose: () => void }) {
  const toast = useToast(); const [o, setO] = useState(''); const [p, setP] = useState(''); const [c, setC] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return; if (p !== c) return setErr('Konfirmasi password tidak sama'); setBusy(true); setErr('');
    try { await api('/portal/change-password', { body: { old_password: o, new_password: p } }); toast('Password diperbarui'); onClose(); } catch (x: any) { setErr(x.message); setBusy(false); }
  };
  return (
    <Modal title="Ganti Password Portal" onClose={onClose}>
      <form onSubmit={go} className="space-y-4"><PasswordInput id="po" label="Password saat ini" value={o} onChange={setO} /><PasswordInput id="pn" label="Password baru (min. 8 karakter)" value={p} onChange={setP} /><PasswordInput id="pc" label="Konfirmasi password baru" value={c} onChange={setC} />
        {err && <p className="note-bad !text-bad" role="alert">{err}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn-o" onClick={onClose}>Batal</button><button className="btn-p" disabled={busy}>Simpan</button></div></form>
    </Modal>
  );
}

// ============ Batch 6: Dashboard ormas ============
const Mini = ({ title, icon: Icon, to, children }: any) => (
  <Link to={to} className="card card-lift block min-w-0 p-4">
    <div className="mb-2 flex items-center gap-2"><Icon size={16} className="text-gold" /><h3 className="text-xs font-bold uppercase tracking-wide text-muted">{title}</h3></div>
    {children}
  </Link>
);
const Sec = ({ title, children, className = '' }: any) => <section className={`card min-w-0 p-5 ${className}`}><h2 className="card-title mb-3">{title}</h2>{children}</section>;
const hariText = (h: number | null) => (h == null ? '' : h < 0 ? `lewat ${-h} hari` : h === 0 ? 'berakhir hari ini' : `${h} hari lagi`);

const QUICK: [string, string, any][] = [
  ['Update Identitas Ormas', '/portal/data#sec-identitas', Pencil], ['Company Profile', '/portal/data#sec-company-profile', FileText], ['Nama Pengurus', '/portal/data#sec-pengurus', Users], ['Kontak dan Alamat', '/portal/data#sec-kontak', MapPin],
  ['Jumlah Anggota', '/portal/data#sec-anggota', Users], ['Dokumen Tambahan', '/portal/data#sec-dokumen-tambahan', FileText], ['Legal Standing', '/portal/data#sec-legal', ShieldCheck], ['Laporan Kegiatan Tahunan', '/portal/laporan', ClipboardList],
];

export function PortalDashboard() {
  const { dash } = useOutletContext<any>();
  const { data: d, error, reload } = dash;
  if (!d) return error ? <ErrorBox text={error} retry={reload} /> : <Skeleton rows={6} />;
  const p = d.profil, cp = d.company_profile, lg = d.legal, rd = d.ringkasan_dokumen, lap = d.laporan;
  const pct = Math.round((p.lengkap / Math.max(1, p.total)) * 100);
  const cpTone = cp.status === 'Lengkap' ? 'text-ok' : cp.status === 'Belum lengkap' ? 'text-warn' : 'text-bad';
  return (
    <div className="stagger space-y-4">
      {d.akan_habis.length > 0 && (
        <section className="note-warn" role="alert">
          <p className="flex items-center gap-2 font-semibold"><TriangleAlert size={17} className="shrink-0 text-warn" /> Dokumen yang akan habis masa berlakunya</p>
          <ul className="mt-2 space-y-1.5">{d.akan_habis.map((x: any) => (
            <li key={x.kode} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span><b>{x.nama}</b> · berakhir {x.tanggal_berakhir || '-'} <Chip tone={DOK_TONE[x.status]}>{x.status}{x.hari != null ? ` (${hariText(x.hari)})` : ''}</Chip></span><Link to={x.link} className="btn-o py-1">Perbarui sekarang</Link></li>
          ))}</ul>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Mini title="Status profil ormas" icon={Building2} to="/portal/data">
          <div className="flex flex-wrap items-center gap-2"><Badge s={p.status_dokumen} />{p.menunggu_verifikasi && <Chip tone="text-info">Menunggu verifikasi admin</Chip>}</div>
          <p className="mt-2 text-sm"><b>{p.lengkap}</b> dari {p.total} bagian data sudah terisi</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-soft/60" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Kelengkapan data"><div className="h-1.5 rounded-full bg-gold" style={{ width: `${pct}%` }} /></div>
          <p className="mt-2 text-xs text-muted">{p.status_operasional} · {p.status_publikasi === 'Publik' ? 'Tampil di katalog' : 'Disembunyikan'}</p>
        </Mini>
        <Mini title="Company Profile" icon={FileText} to="/portal/data#sec-company-profile">
          <Chip tone={cpTone}>{cp.status}</Chip>
          <p className="mt-2 text-sm"><b>{cp.terisi}</b> dari {cp.total} bagian wajib tercentang</p>
          {cp.kurang.length > 0 && <p className="mt-1 text-xs text-warn">Belum: {cp.kurang.slice(0, 3).join(', ')}{cp.kurang.length > 3 ? `, +${cp.kurang.length - 3} lainnya` : ''}</p>}
        </Mini>
        <Mini title="Legal Standing" icon={ShieldCheck} to="/portal/data#sec-legal">
          <Chip tone={legalTone(lg.status)}>{legalText(lg.status)}</Chip>
          {lg.status === 'ya' && <p className="mt-2 text-sm [overflow-wrap:anywhere]">{[lg.jenis, lg.nomor, lg.tahun && `Tahun ${lg.tahun}`].filter(Boolean).join(' · ') || 'Lengkapi jenis dan nomor'}{lg.berlaku_sd && <span className="block text-xs text-muted">Berlaku s/d {lg.berlaku_sd}</span>}</p>}
          {lg.status === 'tidak' && <p className="mt-2 text-xs text-muted">Tidak wajib mengisi data dokumen. Ubah statusnya bila nanti sudah memiliki.</p>}
          {lg.status === '' && <p className="mt-2 text-xs text-bad">Jawab pertanyaan "Apakah sudah memiliki Legal Standing?"</p>}
        </Mini>
        <Mini title="Status dokumen" icon={FileText} to="#tabel-dokumen">
          <div className="flex flex-wrap gap-1.5">{([['Aktif', rd.aktif], ['Akan Berakhir', rd.akan_berakhir], ['Segera Diperbarui', rd.segera_diperbarui], ['Kedaluwarsa', rd.kedaluwarsa], ['Belum Memiliki Data', rd.belum]] as [string, number][]).filter(([, n]) => n > 0).map(([s, n]) => <Chip key={s} tone={DOK_TONE[s]}>{n} {s}</Chip>)}</div>
          {Object.values(rd).every((n) => n === 0) && <p className="text-sm text-muted">Belum ada data dokumen.</p>}
        </Mini>
        <Mini title={`Laporan tahunan ${lap.tahun}`} icon={ClipboardList} to="/portal/laporan">
          <Chip tone={LAP_TONE[lap.status]}>{LAP_TEXT[lap.status]}</Chip>
          <p className="mt-2 text-sm"><b>{lap.arsip}</b> laporan tersimpan di arsip</p>
          {lap.tahun_lalu_belum && <p className="mt-1 text-xs text-bad">Laporan {lap.tahun_lalu_belum} belum dikirim.</p>}
        </Mini>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Sec title="Data yang perlu diperbarui">
          {d.perlu_diperbarui.length ? <ul className="divide-y divide-line">{d.perlu_diperbarui.map((x: any, i: number) => <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0"><span className="min-w-0 [overflow-wrap:anywhere]">{x.label}</span><Link to={x.link} className="txt-link inline-flex shrink-0 items-center gap-1 text-xs">Perbarui <ArrowRight size={13} /></Link></li>)}</ul> : <p className="text-sm text-ok">Semua data sudah lengkap dan terbaru.</p>}
        </Sec>
        <Sec title="Catatan Admin">
          {d.catatan_admin.length ? <ul className="space-y-2">{d.catatan_admin.map((c: any, i: number) => <li key={i} className="panel text-sm"><p className="text-xs font-semibold text-gold">{c.jenis}</p><p className="mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere]">{c.teks}</p>{c.link && <Link to={c.link} className="txt-link mt-1 inline-flex items-center gap-1 text-xs">Buka <ArrowRight size={12} /></Link>}</li>)}</ul> : <Empty text="Belum ada catatan dari admin." />}
        </Sec>
      </div>

      <section id="tabel-dokumen" className="card-solid scroll-mt-24 overflow-x-auto">
        <div className="p-5 pb-2"><h2 className="card-title">Monitoring masa berlaku dokumen</h2><p className="mt-1 text-xs text-muted">Dipantau per dokumen, bukan berdasarkan umur organisasi.</p></div>
        <table className="tbl tbl-dense"><thead><tr><th className="th">Nama dokumen</th><th className="th">Tanggal berlaku</th><th className="th">Tanggal berakhir</th><th className="th">Status</th><th className="th col-act">Aksi</th></tr></thead>
          <tbody>{d.dokumen.map((x: any) => (
            <tr key={x.kode}>
              <td data-label="Dokumen" className="td min-w-[150px]"><div><b>{x.nama}</b>{x.opsional && <span className="ml-1 text-[11px] text-muted">(opsional)</span>}{x.keterangan && <div className="text-xs text-muted">{x.keterangan}</div>}</div></td>
              <td data-label="Berlaku" className="td text-xs"><div>{x.tanggal_berlaku || '-'}</div></td>
              <td data-label="Berakhir" className="td text-xs"><div>{x.tanggal_berakhir || '-'}{x.hari != null && <div className={x.hari < 0 ? 'text-bad' : x.hari <= 30 ? 'text-warn' : 'text-muted'}>{hariText(x.hari)}</div>}</div></td>
              <td data-label="Status" className="td"><div><Chip tone={DOK_TONE[x.status]}>{x.status}</Chip></div></td>
              <td data-label="Aksi" className="td col-act"><div><Link to={x.link} className="btn-o py-1">{x.status === 'Belum Memiliki Data' ? 'Lengkapi' : 'Perbarui'}</Link></div></td>
            </tr>))}</tbody></table>
      </section>

      <Sec title="Akses cepat pengelolaan data">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{QUICK.map(([l, to, Icon]) => <Link key={l} to={to} className="panel card-lift flex items-center gap-2.5 text-sm font-semibold hover:!border-gold/50"><Icon size={16} className="shrink-0 text-gold" />{l}</Link>)}</div>
      </Sec>

      <div className="grid gap-4 lg:grid-cols-5">
        <NotifPanel d={d} reload={reload} />
        <Sec title="Pengumuman SIDOMAS" className="lg:col-span-2">
          {d.pengumuman.length ? <ul className="space-y-2">{d.pengumuman.map((a: any) => <li key={a.id} className="panel text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><Chip tone={NOTIF_TONE[a.kategori]}>{a.kategori}</Chip><span className="text-[11px] text-muted">{fmtDate(a.created_at)}</span></div><p className="mt-1 font-semibold">{a.judul}</p><p className="mt-0.5 whitespace-pre-wrap text-xs text-muted [overflow-wrap:anywhere]">{a.pesan}</p></li>)}</ul> : <Empty text="Belum ada pengumuman." />}
        </Sec>
      </div>
    </div>
  );
}

function NotifPanel({ d, reload }: { d: any; reload: () => void }) {
  const toast = useToast(); const [kat, setKat] = useState('');
  const items = d.notifikasi.items.filter((x: any) => !kat || x.kategori === kat);
  const read = async (id: number) => { try { await api(`/portal/notifikasi/${id}/read`, { method: 'POST', body: {} }); reload(); } catch (e: any) { toast(e.message, false); } };
  const readAll = async () => { try { await api('/portal/notifikasi/read-all', { method: 'POST', body: {} }); reload(); } catch (e: any) { toast(e.message, false); } };
  return (
    <section className="card min-w-0 p-5 lg:col-span-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="card-title">Notifikasi {d.notifikasi.unread > 0 && <span className="ml-1 rounded-full bg-gold px-2 text-xs font-bold text-navy-night">{d.notifikasi.unread} baru</span>}</h2>
        {d.notifikasi.unread > 0 && <button type="button" className="txt-link text-xs" onClick={readAll}>Tandai semua dibaca</button>}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter kategori notifikasi">
        {['', 'Required Action', 'Warning', 'Information'].map((k) => <button key={k} type="button" aria-pressed={kat === k} className={kat === k ? 'btn-p !py-1 !text-xs' : 'btn-o !py-1 !text-xs'} onClick={() => setKat(k)}>{k || 'Semua'}</button>)}
      </div>
      {items.length ? <ul className="space-y-2">{items.map((n: any) => (
        <li key={n.id} className={`panel text-sm ${n.dibaca ? 'opacity-75' : '!border-gold/40'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><Chip tone={NOTIF_TONE[n.kategori]}>{n.kategori}</Chip><span className="text-[11px] text-muted">{fmtDate(n.created_at)}</span></div>
          <p className={`mt-1 ${n.dibaca ? '' : 'font-bold'}`}>{n.judul}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted [overflow-wrap:anywhere]">{n.pesan}</p>
          {!n.dibaca && <button type="button" className="txt-link mt-1 text-xs" onClick={() => read(n.id)}>Tandai dibaca</button>}
        </li>))}</ul> : <Empty text="Tidak ada notifikasi pada kategori ini." />}
    </section>
  );
}

// ============ Batch 7: Laporan Kegiatan Tahunan ============
const LIMIT: Record<string, number> = { rencana_program: 5000, pelaksanaan_kegiatan: 5000, sumber_dana: 500, penutup: 3000 };
const EMPTY_F = { rencana_program: '', pelaksanaan_kegiatan: '', biaya_kegiatan: '', sumber_dana: '', dokumentasi_link: '', penutup: '' };

export function PortalLaporan() {
  const { me } = useOutletContext<any>();
  const list = useFetch<any>('/portal/laporan');
  const [tahun, setTahun] = useState<number | null>(null);
  const th0 = list.data?.tahun_ini;
  useEffect(() => { if (tahun == null && th0) setTahun(th0); }, [th0]);
  const lama = (me.docs || []).find((x: any) => x.jenis_dokumen === 'dokumentasi');
  if (list.error && !list.data) return <ErrorBox text={list.error} retry={list.reload} />;
  if (!list.data || tahun == null) return <Skeleton rows={5} />;
  const years: number[] = []; for (let y = list.data.tahun_ini; y >= list.data.tahun_min; y--) years.push(y);
  const by: Record<number, any> = Object.fromEntries(list.data.items.map((x: any) => [x.tahun, x]));
  return (
    <div className="stagger space-y-4">
      <div><p className="eyebrow">Wajib setiap tahun</p><h1 className="page-title">Laporan Kegiatan Tahunan</h1><p className="page-sub">Laporan dibuat terpisah per tahun. Laporan yang sudah dikirim tersimpan sebagai arsip dan tidak hilang saat tahun berganti.</p></div>
      <div className="card p-4">
        <label className="lbl" htmlFor="lap-th">Pilih tahun laporan</label>
        <select id="lap-th" className="inp max-w-xs" value={tahun} onChange={(e) => setTahun(+e.target.value)}>{years.map((y) => <option key={y} value={y}>{y} · {LAP_TEXT[by[y]?.status || 'belum']}</option>)}</select>
      </div>
      <LaporanForm key={tahun} tahun={tahun} onSaved={list.reload} />
      <section className="card-solid overflow-x-auto">
        <div className="p-5 pb-2"><h2 className="card-title">Arsip laporan tahunan</h2></div>
        {list.data.items.length ? (
          <table className="tbl tbl-dense"><thead><tr><th className="th">Tahun</th><th className="th">Status</th><th className="th">Dikirim</th><th className="th">Biaya kegiatan</th><th className="th col-act">Aksi</th></tr></thead>
            <tbody>{list.data.items.map((x: any) => (
              <tr key={x.id}><td data-label="Tahun" className="td"><div><b>{x.tahun}</b></div></td><td data-label="Status" className="td"><div><Chip tone={LAP_TONE[x.status]}>{LAP_TEXT[x.status]}</Chip></div></td><td data-label="Dikirim" className="td text-xs"><div>{x.dikirim_at ? fmtDate(x.dikirim_at) : '-'}</div></td><td data-label="Biaya" className="td text-xs"><div>{rupiah(x.biaya_kegiatan)}</div></td>
                <td data-label="Aksi" className="td col-act"><div><button type="button" className="btn-o py-1" onClick={() => { setTahun(x.tahun); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{x.status === 'dikirim' ? 'Lihat' : 'Lanjutkan'}</button></div></td></tr>))}</tbody></table>
        ) : <Empty text="Belum ada laporan. Pilih tahun di atas lalu mulai menyusun laporan." />}
      </section>
      {lama && <section className="note-info"><p className="font-semibold">Laporan lama (PDF tunggal sebelum sistem laporan per tahun)</p><p className="mt-1 text-xs">{lama.nama_file} ({fmtSize(lama.ukuran_file)}) tetap tersimpan.</p><a className="btn-o mt-2 py-1" target="_blank" rel="noreferrer" href={`/api/portal/files/${lama.id}`}><ExternalLink size={14} /> Buka PDF</a></section>}
    </div>
  );
}

function Block({ label, hint, children }: any) { return <div className="md:col-span-2"><p className="lbl">{label}</p>{hint && <p className="-mt-1 mb-1 text-xs text-muted">{hint}</p>}{children}</div>; }

function LaporanForm({ tahun, onSaved }: { tahun: number; onSaved: () => void }) {
  const toast = useToast(); const { data: meta } = useFetch<any>('/public/meta'); const maxMb = meta?.max_pdf_mb || 20;
  const [row, setRow] = useState<any>(null); const [err, setErr] = useState(''); const [f, setF] = useState<any>(EMPTY_F);
  const [file, setFile] = useState<File | null>(null); const [rmDok, setRmDok] = useState(false); const [busy, setBusy] = useState(false); const [ask, setAsk] = useState(false);
  // Diambil manual (bukan useFetch) agar isian yang sedang diketik tidak tertimpa pembaruan otomatis
  const load = () => api(`/portal/laporan/${tahun}`).then((r) => {
    setRow(r); setErr(''); setFile(null); setRmDok(false);
    setF({ rencana_program: r.rencana_program ?? '', pelaksanaan_kegiatan: r.pelaksanaan_kegiatan ?? '', biaya_kegiatan: r.biaya_kegiatan == null ? '' : String(r.biaya_kegiatan), sumber_dana: r.sumber_dana ?? '', dokumentasi_link: r.dokumentasi_link ?? '', penutup: r.penutup ?? '' });
  }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  if (err) return <ErrorBox text={err} retry={load} />;
  if (!row) return <Skeleton rows={4} />;
  const status = row.status || 'belum'; const locked = status === 'dikirim';
  const set = (k: string, v: string) => setF((p: any) => ({ ...p, [k]: v }));
  const pick = (x?: File) => {
    if (!x) return;
    if (x.type !== 'application/pdf') return toast(`"${x.name}" harus berformat PDF`, false);
    if (x.size > maxMb * 1048576) return toast(`"${x.name}" melebihi ${maxMb} MB`, false);
    setFile(x); setRmDok(false);
  };
  const kurang = () => {
    const k: string[] = [];
    if (!f.rencana_program.trim()) k.push('Rencana program kegiatan'); if (!f.pelaksanaan_kegiatan.trim()) k.push('Pelaksanaan program kegiatan');
    if (f.biaya_kegiatan === '') k.push('Besaran biaya kegiatan (isi 0 bila tidak ada)'); if (!f.sumber_dana.trim()) k.push('Sumber dana kegiatan'); if (!f.penutup.trim()) k.push('Penutup');
    return k;
  };
  const submit = async (aksi: 'simpan' | 'kirim') => {
    if (busy) return; setBusy(true);
    const fd = new FormData(); fd.append('aksi', aksi); Object.keys(EMPTY_F).forEach((k) => fd.append(k, String(f[k] ?? '')));
    if (file) fd.append('dokumentasi', file); if (rmDok) fd.append('hapus_dokumentasi', '1');
    try {
      await api(`/portal/laporan/${tahun}`, { method: 'PUT', form: fd });
      toast(aksi === 'kirim' ? `Laporan ${tahun} terkirim dan tersimpan sebagai arsip.` : 'Draf laporan tersimpan.');
      setAsk(false); await load(); onSaved();
    } catch (x: any) { toast(x.message, false); setAsk(false); } finally { setBusy(false); }
  };
  const tryKirim = () => { const k = kurang(); if (k.length) return toast(`Lengkapi dulu: ${k.join(', ')}`, false); setAsk(true); };
  const area = (k: string, label: string, rows = 5) => (
    <Block label={label}>
      {locked ? <p className="panel whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{f[k] || '-'}</p> : (
        <><textarea id={k} rows={rows} maxLength={LIMIT[k]} className="inp" aria-label={label} value={f[k]} onChange={(e) => set(k, e.target.value)} /><p className="mt-0.5 text-right text-[11px] text-muted">{f[k].length}/{LIMIT[k]}</p></>
      )}
    </Block>
  );
  const dokUrl = `/api/portal/laporan/${tahun}/dokumentasi`;
  return (
    <section className="card-solid grid gap-4 p-4 sm:p-6 md:grid-cols-2" aria-label={`Laporan kegiatan tahunan ${tahun}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 md:col-span-2">
        <h2 className="text-lg font-bold text-ink">Laporan Kegiatan Tahunan {tahun}</h2>
        <div className="flex items-center gap-2"><Chip tone={LAP_TONE[status]}>{LAP_TEXT[status]}</Chip>{row.dikirim_at && <span className="text-xs text-muted">Dikirim {fmtDate(row.dikirim_at)}</span>}</div>
      </div>
      {status === 'revisi' && <p className="note-bad md:col-span-2"><b>Admin meminta revisi.</b> {row.catatan_admin || 'Perbaiki laporan lalu kirim ulang.'}</p>}
      {locked && <p className="note-info md:col-span-2">Laporan ini sudah dikirim dan terkunci sebagai arsip. Hubungi admin bila perlu revisi.</p>}

      <h3 className="form-h">A. Rencana Program Kegiatan</h3>
      {area('rencana_program', 'Rencana kegiatan yang akan dilaksanakan dalam tahun ini')}

      <h3 className="form-h">B. Pelaksanaan Program Kegiatan</h3>
      {area('pelaksanaan_kegiatan', 'Pelaksanaan kegiatan')}
      <div>
        <label className="lbl" htmlFor="biaya">Besaran biaya kegiatan (Rp)</label>
        {locked ? <p className="panel text-sm">{rupiah(row.biaya_kegiatan)}</p> : <input id="biaya" inputMode="numeric" className="inp" placeholder="0" maxLength={13} value={f.biaya_kegiatan} onChange={(e) => set('biaya_kegiatan', e.target.value.replace(/\D/g, ''))} />}
        {!locked && f.biaya_kegiatan !== '' && <p className="mt-0.5 text-xs text-muted">{rupiah(f.biaya_kegiatan)}</p>}
      </div>
      <div>
        <label className="lbl" htmlFor="sumber">Sumber dana kegiatan</label>
        {locked ? <p className="panel text-sm [overflow-wrap:anywhere]">{f.sumber_dana || '-'}</p> : <input id="sumber" className="inp" maxLength={500} placeholder="Mis. iuran anggota, hibah, donatur" value={f.sumber_dana} onChange={(e) => set('sumber_dana', e.target.value)} />}
      </div>
      <Block label="Dokumentasi kegiatan" hint="Isi link (mis. folder Google Drive) dan/atau unggah satu PDF. Keduanya opsional.">
        {locked ? (
          <div className="panel space-y-1 text-sm">
            {row.dokumentasi_link ? <a className="text-link underline [overflow-wrap:anywhere]" target="_blank" rel="noopener noreferrer" href={row.dokumentasi_link}>{row.dokumentasi_link}</a> : <p className="text-muted">Tidak ada link dokumentasi.</p>}
            {row.ada_dok ? <p><a className="btn-o py-1" target="_blank" rel="noreferrer" href={dokUrl}><ExternalLink size={14} /> Buka {row.dokumentasi_nama || 'PDF'}</a> <a className="btn-o py-1" href={`${dokUrl}?dl=1`}><Download size={14} /> Unduh</a></p> : <p className="text-muted">Tidak ada PDF dokumentasi.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <input id="dok-link" type="url" className="inp" maxLength={500} placeholder="https://drive.google.com/..." aria-label="Link dokumentasi" value={f.dokumentasi_link} onChange={(e) => set('dokumentasi_link', e.target.value)} />
            <div className={`drop ${file || (row.ada_dok && !rmDok) ? 'drop-on' : ''}`}>
              <input id="dok-pdf" type="file" accept="application/pdf" aria-label="Unggah PDF dokumentasi" className="w-full text-xs" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
              <p className="mt-1 text-xs text-muted">{file ? <>Akan diunggah: <b>{file.name}</b> ({fmtSize(file.size)}) <button type="button" className="text-bad underline" onClick={() => setFile(null)}>batal</button></> : row.ada_dok && !rmDok ? <>Tersimpan: {row.dokumentasi_nama || 'PDF'}. <a className="text-link underline" target="_blank" rel="noreferrer" href={dokUrl}>Buka</a> · pilih file baru untuk mengganti.</> : `PDF maks. ${maxMb} MB (opsional)`}</p>
              {row.ada_dok && !file && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" checked={rmDok} onChange={(e) => setRmDok(e.target.checked)} />Hapus PDF tersimpan</label>}
            </div>
          </div>
        )}
      </Block>

      <h3 className="form-h">C. Penutup</h3>
      {area('penutup', 'Kesimpulan atau penutup laporan kegiatan tahunan', 4)}

      {!locked && (
        <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
          <button type="button" className="btn-o" disabled={busy} onClick={() => submit('simpan')}>{busy ? <Spinner /> : <Save size={16} />} Simpan draf</button>
          <button type="button" className="btn-p" disabled={busy} onClick={tryKirim}><Send size={16} /> Kirim laporan</button>
        </div>
      )}
      {ask && <Confirm title={`Kirim laporan ${tahun}`} text={`Setelah dikirim, Laporan Kegiatan Tahunan ${tahun} terkunci dan tersimpan sebagai arsip. Perubahan hanya bisa dilakukan jika admin meminta revisi. Lanjutkan?`} onYes={() => submit('kirim')} onNo={() => setAsk(false)} />}
    </section>
  );
}
