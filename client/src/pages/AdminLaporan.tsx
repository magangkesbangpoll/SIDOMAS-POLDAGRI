import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Download, Eye, FileText, RotateCcw, Search } from 'lucide-react';
import { api } from '../api';
import { Empty, ErrorBox, LaporanBadge, Modal, Pager, Skeleton, WorkProgress, fmtDate, qs, useDebounced, useFetch, useToast } from '../ui';
import { useAuth } from './Admin';

export function AdminLaporanPage() {
  const me = useAuth(); const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [tahun, setTahun] = useState<number | ''>('');
  const [status, setStatus] = useState(''); const [q, setQ] = useState(''); const [page, setPage] = useState(1);
  useEffect(() => {
    const st = sp.get('status'), th = sp.get('tahun'), cari = sp.get('q');
    if (st == null && th == null && cari == null) return;
    if (st != null) setStatus(st); if (th != null) setTahun(+th); if (cari != null) setQ(cari);
    setSp({}, { replace: true });
  }, [sp]);
  const dq = useDebounced(q);
  useEffect(() => setPage(1), [dq, status, tahun]);
  const { data: d, loading, error, reload } = useFetch<any>('/admin/laporan?' + qs({ tahun, status, q: dq, page }));
  const [detail, setDetail] = useState<any>(null); const [revisi, setRevisi] = useState<any>(null); const [catatan, setCatatan] = useState(''); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState<any>(null);
  const [view, setView] = useState<any>(null);
  const can = (p: string) => me.perms.includes(p);
  const th = d?.tahun || new Date().getFullYear();
  const tahunList = Array.from({ length: 11 }, (_, i) => th - i);

  const kirimRevisi = async () => {
    if (busy || !catatan.trim()) return; setBusy(true);
    try { await api(`/admin/laporan/${revisi.laporan_id}/revisi`, { method: 'POST', body: { catatan: catatan.trim() } }); toast('Permintaan revisi terkirim ke ormas'); setRevisi(null); setCatatan(''); reload(); }
    catch (e: any) { toast(e.message, false); } finally { setBusy(false); }
  };
  const tandaiSelesai = async (l: any) => {
    if (busy) return; setBusy(true); setProgress({ nama: l.nama_ormas || l.ormas || '', tahun: l.tahun });
    try { await api(`/admin/laporan/${l.id}/selesai`, { method: 'POST' }); toast('Laporan ditandai selesai'); reload(); }
    catch (e: any) { toast(e.message, false); } finally { setBusy(false); setProgress(null); }
  };

  return (
    <div className="stagger space-y-4">
      <div><p className="eyebrow">Monitoring kewajiban tahunan</p><h1 className="page-title">Laporan Kegiatan Tahunan</h1><p className="page-sub">Pantau file PDF laporan seluruh ormas, lihat arsip per tahun, dan minta revisi bila diperlukan. Laporan yang sudah dikirim tetap tersimpan sebagai arsip.</p></div>

      {d?.ringkasan && <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          ['Total ormas', d.ringkasan.total, 'text-gold'],
          ['Sudah mengirim', d.ringkasan.sudah_mengirim ?? d.ringkasan.dikirim, 'text-ok'],
          ['Belum mengirim', d.ringkasan.belum_mengirim ?? 0, 'text-warn'],
          ['Belum lengkap', d.ringkasan.belum_lengkap ?? 0, 'text-warn'],
          ['Menunggu verifikasi', d.ringkasan.menunggu_verifikasi ?? d.ringkasan.dikirim, 'text-info'],
          ['Dikembalikan', d.ringkasan.dikembalikan ?? d.ringkasan.revisi, 'text-bad'],
          ['Selesai', d.ringkasan.selesai ?? 0, 'text-ok'],
        ].map(([l, n, tone]) => (
          <div key={l} className="card p-4"><p className="text-xs font-semibold text-muted">{l} · {th}</p><p className={`mt-2 text-2xl font-extrabold leading-none ${tone}`}>{n}</p></div>
        ))}
      </div>}

      <div className="card grid gap-3 p-3 md:grid-cols-4">
        <div className="relative md:col-span-2"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="inp pl-9" placeholder="Cari nama atau ID ormas" aria-label="Cari ormas" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="inp" aria-label="Tahun laporan" value={tahun} onChange={(e) => setTahun(e.target.value ? +e.target.value : '')}><option value="">Tahun berjalan ({new Date().getFullYear()})</option>{tahunList.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <select className="inp" aria-label="Status laporan" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Semua status</option>{['belum', 'draft', 'revisi', 'dikirim', 'selesai', 'menunggu_verifikasi', 'dikembalikan'].map((s) => <option key={s} value={s}>{({ belum: 'Belum ada PDF', draft: 'Draf', revisi: 'Dikembalikan', dikirim: 'Menunggu verifikasi', selesai: 'Selesai', menunggu_verifikasi: 'Menunggu verifikasi', dikembalikan: 'Dikembalikan' } as any)[s]}</option>)}</select>
      </div>

      <div className="card-solid overflow-x-auto">
        {error ? <div className="p-4"><ErrorBox text={error} retry={reload} /></div> : loading && !d ? <Skeleton /> : !d?.items.length ? <Empty text="Tidak ada laporan yang cocok dengan filter." /> : (
          <table className="tbl tbl-dense"><thead><tr>{['ID Ormas', 'Nama Ormas', 'Tahun', 'Status', 'Dikirim', 'File PDF', 'Diperbarui', 'Aksi'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{d.items.map((x: any) => <tr key={x.ormas_id}>
              <td data-label="ID Ormas" className="td mono font-semibold text-link">{x.kode_ormas}</td>
              <td data-label="Nama Ormas" className="td min-w-[180px] font-semibold">{x.nama_ormas}</td>
              <td data-label="Tahun" className="td">{th}</td>
              <td data-label="Status" className="td"><LaporanBadge status={x.status} /></td>
              <td data-label="Dikirim" className="td text-xs">{x.dikirim_at ? fmtDate(x.dikirim_at) : '-'}</td>
              <td data-label="File PDF" className="td text-xs">{x.ada_dok ? <a className="txt-link inline-flex items-center gap-1" href={`/api/admin/laporan/${x.laporan_id}/dokumentasi?dl=1`}><Download size={13} /> Unduh</a> : <span className="text-muted">Belum ada</span>}</td>
              <td data-label="Diperbarui" className="td text-xs">{x.updated_at ? fmtDate(x.updated_at) : '-'}</td>
              <td data-label="Aksi" className="td"><div className="flex flex-wrap gap-1.5">
                <button className="icon-btn" title="Lihat semua tahun" aria-label="Lihat arsip ormas" onClick={() => setDetail(x)}><Eye size={15} /></button>
                {can('manage_ormas') && x.status === 'dikirim' && <button className="icon-btn hover:!border-gold/50 hover:!text-gold" title="Tandai selesai" aria-label="Tandai selesai" onClick={() => tandaiSelesai({ ...x, id: x.laporan_id })}><Check size={15} /></button>}
                {can('manage_ormas') && x.status === 'dikirim' && <button className="icon-btn hover:!border-gold/50 hover:!text-gold" title="Minta revisi" aria-label="Minta revisi" onClick={() => { setRevisi(x); setCatatan(''); }}><RotateCcw size={15} /></button>}
              </div></td>
            </tr>)}</tbody></table>
        )}
      </div>
      {d && <Pager page={page} total={d.total} size={d.pageSize || 15} onPage={setPage} />}

      {detail && <ArsipModal item={detail} tahun={th} onClose={() => setDetail(null)} onRevisi={(l: any) => { setDetail(null); setRevisi(l); setCatatan(''); }} onSelesai={(l: any) => { setDetail(null); tandaiSelesai(l); }} canRevisi={can('manage_ormas')} onView={setView} />}
      {view && <Modal wide title={`Dokumentasi ${view.tahun || ''}`} onClose={() => setView(null)}><iframe title="Dokumentasi laporan" src={`/api/admin/laporan/${view.id}/dokumentasi`} className="h-[70vh] w-full rounded-xl border border-line bg-white" /></Modal>}
      {revisi && <Modal title={`Minta revisi · ${revisi.kode_ormas}`} onClose={() => setRevisi(null)}>
        <p className="text-sm text-muted">Tuliskan bagian yang perlu diperbaiki oleh <b>{revisi.nama_ormas}</b> pada laporan tahun {th}. Catatan ini tampil di dashboard ormas sebagai notifikasi <b>Required Action</b>, dan laporan dapat dikirim ulang setelah diperbaiki.</p>
        <textarea className="inp mt-3" rows={5} maxLength={900} autoFocus placeholder="Mis. Perbaiki isi PDF bagian pelaksanaan kegiatan dan unggah ulang…" value={catatan} onChange={(e) => setCatatan(e.target.value)} aria-label="Catatan revisi" />
        <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-o" onClick={() => setRevisi(null)}>Batal</button><button type="button" className="btn-p" disabled={busy || !catatan.trim()} onClick={kirimRevisi}>Kirim permintaan revisi</button></div>
      </Modal>}
      {progress && <WorkProgress title="Menyetujui laporan tahunan" subject={`${progress.nama} · Tahun ${progress.tahun}`} steps={['Menyiapkan folder ormas', `Memindahkan PDF tahun ${progress.tahun} dari pending ke Drive`, 'Menyimpan status Selesai', 'Menunggu konfirmasi server']} />}
    </div>
  );
}

function ArsipModal({ item, tahun, onClose, onRevisi, onSelesai, canRevisi, onView }: any) {
  const { data, loading, error, reload } = useFetch<any>(`/admin/laporan/ormas/${item.ormas_id}`);
  return (
    <Modal drawer title={`Arsip Laporan · ${item.kode_ormas}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="panel"><p className="eyebrow">{item.kode_ormas}</p><h3 className="mt-1 text-lg font-bold">{item.nama_ormas}</h3><p className="mt-1 text-xs text-muted">Tahun berjalan: {tahun}</p></div>
        {error ? <ErrorBox text={error} retry={reload} /> : loading && !data ? <Skeleton rows={4} /> : !data?.items.length ? <Empty text="Ormas ini belum memiliki laporan." /> : (
          <div className="space-y-3">{data.items.map((l: any) => (
            <div key={l.id} className="card-solid p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2"><b className="text-ink">Tahun {l.tahun}</b><LaporanBadge status={l.status} />{l.ada_dok && <span className="chip chip-dot text-info"><FileText size={12} /> PDF</span>}</div>
              <p className="mt-1 text-xs text-muted">{l.dikirim_at ? `Dikirim ${fmtDate(l.dikirim_at)}` : 'Belum dikirim'}{l.updated_at && ` · diperbarui ${fmtDate(l.updated_at)}`}</p>
              <p className="mt-2 text-xs"><b className="text-muted">Berkas:</b> {l.ada_dok ? (l.dokumentasi_nama || 'laporan.pdf') : <span className="text-muted">Belum ada PDF</span>}</p>
              {l.catatan_admin && <p className="note-warn mt-2 !text-xs"><b>Catatan revisi:</b> {l.catatan_admin}</p>}
              <div className="mt-3 flex flex-wrap gap-2">{l.ada_dok ? <><button className="btn-o py-1 text-xs" onClick={() => onView(l)}><FileText size={13} /> Lihat PDF</button><a className="btn-o py-1 text-xs" href={`/api/admin/laporan/${l.id}/dokumentasi?dl=1`}><Download size={13} /> Unduh</a></> : <span className="text-xs text-muted">Tidak ada berkas PDF.</span>}
                {canRevisi && l.status === 'dikirim' && <button className="btn-p py-1 text-xs" onClick={() => onSelesai({ ...l, nama_ormas: item.nama_ormas, kode_ormas: item.kode_ormas })}><Check size={13} /> Tandai selesai</button>}
                {canRevisi && l.status === 'dikirim' && <button className="btn-p py-1 text-xs" onClick={() => onRevisi({ ...item, laporan_id: l.id })}><RotateCcw size={13} /> Minta revisi</button>}
              </div>
            </div>
          ))}</div>
        )}
      </div>
    </Modal>
  );
}
