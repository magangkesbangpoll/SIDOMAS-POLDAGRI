import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ClipboardList, Eye, ExternalLink, Download, Megaphone, ShieldAlert, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Confirm, Empty, ErrorBox, Modal, Pager, Skeleton, Spinner, fmtDate, qs, useDebounced, useFetch, useToast } from '../ui';
import { useAuth } from './Admin';
import { Dashboard } from './Dashboard';
import { Chip, LAP_TEXT, LAP_TONE, LegalChip, NOTIF_TONE, rupiah } from '../batchui';

// ============ Dashboard admin: Dashboard lama + panel Legal Standing (Batch 4) + Laporan Tahunan (Batch 7) ============
export function AdminHome() {
  return <div className="space-y-4"><Dashboard /><BatchPanels /></div>;
}

function Count({ label, value, tone, to }: { label: string; value: number; tone: string; to: string }) {
  return <Link to={to} className="panel card-lift block"><p className={`text-3xl font-extrabold leading-none ${tone}`}>{value.toLocaleString('id-ID')}</p><p className="mt-1.5 text-xs text-muted">{label}</p></Link>;
}

function BatchPanels() {
  const { data: d } = useFetch<any>('/admin/dashboard');
  if (!d?.legal) return null;
  const lg = d.legal, lap = d.laporan; const belum = lg.tidak + lg.belum;
  const pct = (n: number) => Math.round((n / Math.max(1, lg.total)) * 100);
  return (
    <div className="stagger space-y-4">
      {belum > 0 && (
        <div className="note-warn flex flex-wrap items-center justify-between gap-2" role="alert">
          <span className="flex items-center gap-2"><ShieldAlert size={18} className="shrink-0 text-warn" /><span><b>{belum} ormas belum memiliki Legal Standing</b> ({lg.tidak} menyatakan belum memiliki, {lg.belum} belum menjawab).</span></span>
          <Link className="txt-link" to="/admin/ormas?legal_status=belum_memiliki">Lihat daftar</Link>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card min-w-0 p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="card-title">Monitoring Legal Standing</h2><Link to="/admin/ormas" className="txt-link inline-flex items-center gap-1 text-xs">Data ormas <ArrowRight size={13} /></Link></div>
          <div className="grid grid-cols-3 gap-3">
            <Count label="Sudah memiliki" value={lg.ya} tone="text-ok" to="/admin/ormas?legal_status=ya" />
            <Count label="Belum memiliki" value={lg.tidak} tone="text-warn" to="/admin/ormas?legal_status=tidak" />
            <Count label="Belum dikonfirmasi" value={lg.belum} tone="text-muted" to="/admin/ormas?legal_status=belum" />
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-soft/60" role="img" aria-label={`Sudah ${pct(lg.ya)} persen, belum memiliki ${pct(lg.tidak)} persen, belum dikonfirmasi ${pct(lg.belum)} persen`}>
            <span className="bg-ok" style={{ width: `${pct(lg.ya)}%` }} /><span className="bg-warn" style={{ width: `${pct(lg.tidak)}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">Total {lg.total} ormas</p>
          {lg.items.length > 0 && <>
            <h3 className="mb-1 mt-4 text-sm font-semibold">Perlu ditindaklanjuti</h3>
            <ul className="divide-y divide-line">{lg.items.map((o: any) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><Link to={`/admin/ormas?detail=${o.id}`} className="min-w-0 font-semibold text-ink hover:text-link">{o.nama_ormas}<span className="block text-xs font-normal text-muted">{o.kode_ormas}</span></Link><LegalChip s={o.legal_status} /></li>))}</ul>
          </>}
        </section>
        <section className="card min-w-0 p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="card-title">Laporan Kegiatan Tahunan {lap.tahun}</h2><Link to="/admin/laporan" className="txt-link inline-flex items-center gap-1 text-xs">Monitoring <ArrowRight size={13} /></Link></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Count label="Sudah dikirim" value={lap.dikirim} tone="text-ok" to="/admin/laporan?status=dikirim" />
            <Count label="Draf" value={lap.draft} tone="text-warn" to="/admin/laporan?status=draft" />
            <Count label="Perlu revisi" value={lap.revisi} tone="text-bad" to="/admin/laporan?status=revisi" />
            <Count label="Belum dibuat" value={lap.belum} tone="text-muted" to="/admin/laporan?status=belum" />
          </div>
          <p className="mt-3 text-xs text-muted">{lap.dikirim} dari {lap.total} ormas sudah mengirim laporan tahun {lap.tahun}.</p>
        </section>
      </div>
    </div>
  );
}

// ============ Batch 7: monitoring laporan tahunan (semua ormas) ============
export function LaporanPage() {
  const me = useAuth();
  const [sp, setSp] = useSearchParams();
  const [tahun, setTahun] = useState(new Date().getFullYear()); const [status, setStatus] = useState(''); const [q, setQ] = useState(''); const [page, setPage] = useState(1); const [detail, setDetail] = useState<number | null>(null);
  const dq = useDebounced(q); useEffect(() => setPage(1), [dq, status, tahun]);
  useEffect(() => { // parameter dari dashboard dan halaman detail ormas
    const o = +(sp.get('ormas') || 0), st = sp.get('status');
    if (!o && !st) return;
    if (o) setDetail(o); if (st && ['belum', 'draft', 'dikirim', 'revisi'].includes(st)) setStatus(st);
    setSp({}, { replace: true });
  }, [sp]);
  const { data, loading, error, reload } = useFetch<any>('/admin/laporan?' + qs({ tahun, status, q: dq, page }));
  const th0 = new Date().getFullYear(); const years: number[] = []; for (let y = th0; y >= th0 - 9; y--) years.push(y);
  const r = data?.ringkasan;
  return (
    <div className="stagger space-y-4">
      <div><p className="eyebrow">Monitoring</p><h1 className="page-title">Laporan Kegiatan Tahunan</h1><p className="page-sub">Pantau laporan seluruh ormas per tahun, periksa isinya, dan minta revisi bila perlu.</p></div>
      {r && <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{([['Ormas dipantau', r.total, 'text-ink'], ['Sudah dikirim', r.dikirim, 'text-ok'], ['Draf', r.draft, 'text-warn'], ['Perlu revisi', r.revisi, 'text-bad'], ['Belum dibuat', r.belum, 'text-muted']] as [string, number, string][]).map(([l, v, t]) => <div key={l} className="card p-4"><p className={`text-3xl font-extrabold leading-none ${t}`}>{v.toLocaleString('id-ID')}</p><p className="mt-1.5 text-xs text-muted">{l}</p></div>)}</div>}
      <div className="card grid gap-3 p-3 md:grid-cols-4">
        <input className="inp md:col-span-2" placeholder="Cari nama atau ID ormas" aria-label="Cari ormas" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="inp" aria-label="Tahun laporan" value={tahun} onChange={(e) => setTahun(+e.target.value)}>{years.map((y) => <option key={y} value={y}>Tahun {y}</option>)}</select>
        <select className="inp" aria-label="Status laporan" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Semua status</option>{Object.entries(LAP_TEXT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <div className="card-solid overflow-x-auto">
        {error ? <div className="p-4"><ErrorBox text={error} retry={reload} /></div> : loading && !data ? <Skeleton /> : !data?.items.length ? <Empty text="Tidak ada ormas yang cocok dengan filter ini." /> : (
          <table className="tbl tbl-dense"><thead><tr><th className="th">No</th><th className="th">ID Ormas</th><th className="th">Nama Ormas</th><th className="th">Status {data.tahun}</th><th className="th">Dikirim</th><th className="th">Biaya kegiatan</th><th className="th col-act">Aksi</th></tr></thead>
            <tbody>{data.items.map((o: any, i: number) => (
              <tr key={o.ormas_id}><td data-label="No" className="td"><div>{(page - 1) * data.pageSize + i + 1}</div></td><td data-label="ID" className="td mono font-semibold text-link"><div>{o.kode_ormas}</div></td><td data-label="Nama" className="td min-w-[170px]"><div>{o.nama_ormas}</div></td>
                <td data-label="Status" className="td"><div><Chip tone={LAP_TONE[o.status]}>{LAP_TEXT[o.status]}</Chip></div></td><td data-label="Dikirim" className="td text-xs"><div>{o.dikirim_at ? fmtDate(o.dikirim_at) : '-'}</div></td><td data-label="Biaya" className="td text-xs"><div>{rupiah(o.biaya_kegiatan)}</div></td>
                <td data-label="Aksi" className="td col-act"><div><button className="icon-btn" title="Lihat laporan dan arsip" aria-label={`Lihat laporan ${o.nama_ormas}`} onClick={() => setDetail(o.ormas_id)}><Eye size={15} /></button></div></td></tr>))}</tbody></table>)}
      </div>
      {data && <Pager page={page} total={data.total} size={data.pageSize} onPage={setPage} />}
      {detail && <ArsipDrawer ormasId={detail} canRevisi={me.perms.includes('manage_ormas')} canDocs={me.perms.includes('view_docs')} onClose={() => setDetail(null)} onChanged={reload} />}
    </div>
  );
}

function ArsipDrawer({ ormasId, canRevisi, canDocs, onClose, onChanged }: { ormasId: number; canRevisi: boolean; canDocs: boolean; onClose: () => void; onChanged: () => void }) {
  const { data, error, reload } = useFetch<any>(`/admin/laporan/ormas/${ormasId}`);
  const [rev, setRev] = useState<any>(null);
  const sec = (l: string, v: any) => <div><p className="text-xs font-semibold text-gold">{l}</p><p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{v || '-'}</p></div>;
  return (
    <Modal drawer title="Arsip Laporan Tahunan" onClose={onClose}>
      {error ? <ErrorBox text={error} /> : !data ? <Skeleton rows={4} /> : (
        <div className="space-y-4">
          <div className="panel"><p className="eyebrow">{data.ormas.kode_ormas}</p><h3 className="text-lg font-bold">{data.ormas.nama_ormas}</h3></div>
          {!data.items.length ? <Empty text="Ormas ini belum membuat laporan tahunan." /> : data.items.map((l: any, i: number) => (
            <details key={l.id} open={i === 0} className="panel">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 font-semibold"><span>Laporan {l.tahun}</span><Chip tone={LAP_TONE[l.status]}>{LAP_TEXT[l.status]}</Chip></summary>
              <div className="mt-3 space-y-3">
                {l.dikirim_at && <p className="text-xs text-muted">Dikirim {fmtDate(l.dikirim_at)}</p>}
                {l.status === 'revisi' && <p className="note-bad !text-sm"><b>Revisi diminta:</b> {l.catatan_admin}</p>}
                {sec('A. Rencana Program Kegiatan', l.rencana_program)}
                {sec('B. Pelaksanaan Program Kegiatan', l.pelaksanaan_kegiatan)}
                <div className="grid gap-3 sm:grid-cols-2">{sec('Besaran biaya kegiatan', l.biaya_kegiatan == null ? '' : rupiah(l.biaya_kegiatan))}{sec('Sumber dana kegiatan', l.sumber_dana)}</div>
                <div><p className="text-xs font-semibold text-gold">Dokumentasi kegiatan</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-sm">
                    {l.dokumentasi_link && <a className="btn-o py-1" target="_blank" rel="noopener noreferrer" href={l.dokumentasi_link}><ExternalLink size={14} /> Buka link</a>}
                    {l.ada_dok && canDocs && <><a className="btn-o py-1" target="_blank" rel="noreferrer" href={`/api/admin/laporan/${l.id}/dokumentasi`}><ExternalLink size={14} /> Buka PDF</a><a className="btn-o py-1" href={`/api/admin/laporan/${l.id}/dokumentasi?dl=1`}><Download size={14} /> Unduh</a></>}
                    {!l.dokumentasi_link && !l.ada_dok && <span className="text-muted">-</span>}
                  </div></div>
                {sec('C. Penutup', l.penutup)}
                {canRevisi && l.status === 'dikirim' && <div className="text-right"><button type="button" className="btn-o py-1" onClick={() => setRev(l)}>Minta revisi</button></div>}
              </div>
            </details>))}
        </div>)}
      {rev && <RevisiModal l={rev} onClose={() => setRev(null)} onDone={() => { setRev(null); reload(); onChanged(); }} />}
    </Modal>
  );
}

function RevisiModal({ l, onClose, onDone }: { l: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast(); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const go = async () => {
    if (busy) return; if (!note.trim()) return toast('Tulis catatan revisi agar ormas tahu apa yang perlu diperbaiki', false);
    setBusy(true);
    try { await api(`/admin/laporan/${l.id}/revisi`, { method: 'POST', body: { catatan: note.trim() } }); toast('Permintaan revisi dikirim ke ormas'); onDone(); }
    catch (e: any) { toast(e.message, false); setBusy(false); }
  };
  return (
    <Modal title={`Minta revisi laporan ${l.tahun}`} onClose={onClose}>
      <p className="text-sm text-body">Laporan akan dibuka kembali agar ormas dapat memperbaikinya. Catatan ini tampil di dashboard dan notifikasi ormas.</p>
      <textarea className="inp mt-3" rows={4} maxLength={900} aria-label="Catatan revisi" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-o" onClick={onClose}>Batal</button><button type="button" className="btn-p" disabled={busy} onClick={go}>{busy ? <Spinner /> : <ClipboardList size={15} />} Kirim permintaan revisi</button></div>
    </Modal>
  );
}

// ============ Batch 6: kelola pengumuman SIDOMAS (tampil di dashboard semua ormas) ============
export function PengumumanPage() {
  const me = useAuth(); const toast = useToast(); const can = me.perms.includes('manage_ormas');
  const { data, loading, error, reload } = useFetch<any>('/admin/pengumuman');
  const [form, setForm] = useState({ kategori: 'Information', judul: '', pesan: '' }); const [busy, setBusy] = useState(false); const [del, setDel] = useState<any>(null);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    if (form.judul.trim().length < 3) return toast('Judul pengumuman minimal 3 karakter', false);
    if (form.pesan.trim().length < 3) return toast('Isi pengumuman minimal 3 karakter', false);
    setBusy(true);
    try { await api('/admin/pengumuman', { body: { ...form, judul: form.judul.trim(), pesan: form.pesan.trim() } }); toast('Pengumuman dipublikasikan ke semua ormas'); setForm({ kategori: 'Information', judul: '', pesan: '' }); reload(); }
    catch (x: any) { toast(x.message, false); } finally { setBusy(false); }
  };
  const toggle = async (p: any) => { try { await api(`/admin/pengumuman/${p.id}`, { method: 'PUT', body: { aktif: !p.aktif } }); toast(p.aktif ? 'Pengumuman dinonaktifkan' : 'Pengumuman diaktifkan'); reload(); } catch (x: any) { toast(x.message, false); } };
  const remove = async () => { try { await api(`/admin/pengumuman/${del.id}`, { method: 'DELETE' }); toast('Pengumuman dihapus'); setDel(null); reload(); } catch (x: any) { toast(x.message, false); setDel(null); } };
  return (
    <div className="stagger space-y-4">
      <div><p className="eyebrow">Komunikasi</p><h1 className="page-title">Pengumuman SIDOMAS</h1><p className="page-sub">Pengumuman aktif tampil di dashboard seluruh ormas (5 terbaru).</p></div>
      {can && (
        <form onSubmit={add} className="card-solid grid gap-4 p-4 sm:p-6 md:grid-cols-3">
          <div><label className="lbl" htmlFor="pk">Kategori</label><select id="pk" className="inp" value={form.kategori} onChange={(e) => set('kategori', e.target.value)}><option>Information</option><option>Warning</option><option>Required Action</option></select></div>
          <div className="md:col-span-2"><label className="lbl" htmlFor="pj">Judul (3-150 karakter)</label><input id="pj" className="inp" maxLength={150} value={form.judul} onChange={(e) => set('judul', e.target.value)} /></div>
          <div className="md:col-span-3"><label className="lbl" htmlFor="pp">Isi pengumuman (3-1000 karakter)</label><textarea id="pp" rows={3} maxLength={1000} className="inp" value={form.pesan} onChange={(e) => set('pesan', e.target.value)} /></div>
          <div className="flex justify-end md:col-span-3"><button className="btn-p" disabled={busy}>{busy ? <Spinner /> : <Megaphone size={16} />} Publikasikan</button></div>
        </form>
      )}
      <div className="card-solid">
        {error ? <div className="p-4"><ErrorBox text={error} retry={reload} /></div> : loading && !data ? <Skeleton rows={3} /> : !data?.items.length ? <Empty text="Belum ada pengumuman." /> : (
          <ul className="divide-y divide-line">{data.items.map((p: any) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className={`min-w-0 flex-1 ${p.aktif ? '' : 'opacity-60'}`}>
                <div className="flex flex-wrap items-center gap-2"><Chip tone={NOTIF_TONE[p.kategori]}>{p.kategori}</Chip>{!p.aktif && <span className="chip-n">Nonaktif</span>}<span className="text-[11px] text-muted">{fmtDate(p.created_at)}</span></div>
                <p className="mt-1 font-semibold">{p.judul}</p><p className="whitespace-pre-wrap text-sm text-muted [overflow-wrap:anywhere]">{p.pesan}</p>
              </div>
              {can && <div className="flex gap-2"><button type="button" className="btn-o py-1" onClick={() => toggle(p)}>{p.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button><button type="button" className="icon-btn hover:!border-bad/50 hover:!text-bad" aria-label="Hapus pengumuman" title="Hapus" onClick={() => setDel(p)}><Trash2 size={15} /></button></div>}
            </li>))}</ul>)}
      </div>
      {del && <Confirm danger title="Hapus pengumuman" text={`Hapus pengumuman "${del.judul}"? Pengumuman hilang dari dashboard semua ormas.`} onYes={remove} onNo={() => setDel(null)} />}
    </div>
  );
}
