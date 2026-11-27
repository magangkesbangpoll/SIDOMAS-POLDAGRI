import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, FileText, Lock, Save, Send } from 'lucide-react';
import { api } from '../api';
import { Confirm, Empty, ErrorBox, LaporanBadge, Loading, Skeleton, fmtDate, fmtSize, useFetch, useToast } from '../ui';
import { ChangePassword } from './AdminAuth';
import { PortalHeader, usePortalAuth } from './Portal';

export function PortalLaporan() {
  const { me, err, load } = usePortalAuth();
  const { data: daftar, loading, error, reload } = useFetch<any>('/portal/laporan');
  const { data: meta } = useFetch<any>('/public/meta');
  const [tahun, setTahun] = useState<number | null>(null);
  const [scrollEditor, setScrollEditor] = useState(0);
  useEffect(() => { if (daftar?.tahun_ini && tahun == null) setTahun(daftar.tahun_ini); }, [daftar?.tahun_ini]);
  useEffect(() => { if (scrollEditor) document.getElementById('editor-laporan')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [scrollEditor]);

  if (err) return <div className="p-6"><ErrorBox text={err} retry={load} /></div>;
  if (!me) return <Loading />;
  if (me.must_change) return <ChangePassword path="/portal/change-password" onDone={load} />;

  const tahunList = daftar ? Array.from({ length: daftar.tahun_ini - daftar.tahun_min + 1 }, (_, i) => daftar.tahun_ini - i) : [];
  const pilih = (items: any[], th: number) => items.find((x) => x.tahun === th);

  return (
    <div className="min-h-screen">
      <PortalHeader />
      <main className="stagger mx-auto max-w-5xl space-y-4 px-3 py-5 sm:px-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="eyebrow">Kewajiban tahunan</p><h1 className="page-title">Laporan Kegiatan Tahunan</h1><p className="page-sub">Cukup unggah <b>satu file PDF per tahun</b> — tidak perlu mengisi kolom satu per satu. Laporan yang sudah dikirim terkunci sebagai arsip dan tidak hilang pada tahun berikutnya.</p></div>
          <Link to="/portal/dashboard" className="btn-o"><ArrowLeft size={15} /> Dashboard</Link>
        </div>

        {error ? <ErrorBox text={error} retry={reload} /> : loading && !daftar ? <Skeleton /> : daftar && (
          <>
            <div className="card flex flex-wrap items-center gap-3 p-4">
              <label className="text-sm font-semibold text-ink" htmlFor="th">Tahun laporan</label>
              <select id="th" className="inp w-auto min-w-[9rem]" value={tahun ?? daftar.tahun_ini} onChange={(e) => setTahun(+e.target.value)}>{tahunList.map((t) => <option key={t} value={t}>{t}{t === daftar.tahun_ini ? ' (tahun ini)' : ''}</option>)}</select>
              {tahun != null && <LaporanBadge status={pilih(daftar.items, tahun)?.status || 'belum'} />}
              <p className="ml-auto text-xs text-muted">Arsip: <b>{daftar.items.filter((x: any) => ['dikirim', 'selesai'].includes(x.status)).length}</b> laporan</p>
            </div>

            {tahun != null && <div id="editor-laporan" className="scroll-mt-4"><Editor key={tahun} tahun={tahun} maxMb={meta?.max_pdf_mb || 20} onSaved={reload} /></div>}

            <section className="card p-5">
              <h2 className="card-title mb-4">Riwayat laporan (arsip)</h2>
              {daftar.items.length ? <div className="card-solid overflow-x-auto"><table className="tbl tbl-dense"><thead><tr>{['Tahun', 'Status', 'Dikirim', 'File PDF', 'Catatan Admin', 'Aksi'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
                <tbody>{daftar.items.map((x: any) => <tr key={x.id}>
                  <td data-label="Tahun" className="td font-semibold">{x.tahun}</td>
                  <td data-label="Status" className="td"><LaporanBadge status={x.status} /></td>
                  <td data-label="Dikirim" className="td text-xs">{x.dikirim_at ? fmtDate(x.dikirim_at) : '-'}</td>
                  <td data-label="File PDF" className="td text-xs">{x.ada_dok ? <a className="txt-link inline-flex items-center gap-1" href={`/api/portal/laporan/${x.tahun}/dokumentasi?dl=1`}><Download size={13} /> Unduh</a> : <span className="text-muted">Belum diunggah</span>}</td>
                  <td data-label="Catatan" className="td max-w-[18rem] text-xs text-warn">{x.catatan_admin || '-'}</td>
                  <td data-label="Aksi" className="td"><button className="btn-o py-1 text-xs" title={`Tampilkan form dan arsip laporan tahun ${x.tahun}`} onClick={() => { setTahun(x.tahun); setScrollEditor((n) => n + 1); }}>Buka</button></td>
                </tr>)}</tbody></table></div> : <Empty text="Belum ada laporan. Pilih tahun lalu unggah PDF laporan pertama Anda." />}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Editor({ tahun, maxMb, onSaved }: { tahun: number; maxMb: number; onSaved: () => void }) {
  const toast = useToast();
  const { data: l, loading, error, reload } = useFetch<any>(`/portal/laporan/${tahun}`);
  const [file, setFile] = useState<File | null>(null); const [hapus, setHapus] = useState(false);
  const [busy, setBusy] = useState(false); const [kirim, setKirim] = useState(false); const [view, setView] = useState(false);
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (loading && !l) return <Skeleton />;
  if (!l) return null;
  const locked = l.status === 'dikirim' || l.status === 'selesai';
  const punyaPdf = !!file || (!!l.ada_dok && !hapus);

  const simpan = async (aksi: 'simpan' | 'kirim') => {
    if (busy || locked) return;
    if (!punyaPdf) return toast('Pilih file PDF laporan kegiatan tahunan terlebih dahulu', false);
    if (file && file.type !== 'application/pdf') return toast('Laporan harus berupa file PDF', false);
    if (file && file.size > maxMb * 1048576) return toast(`File melebihi ${maxMb} MB`, false);
    setBusy(true);
    const fd = new FormData();
    fd.append('aksi', aksi);
    if (file) fd.append('dokumentasi', file);
    if (hapus && !file) fd.append('hapus_dokumentasi', '1');
    try {
      await api(`/portal/laporan/${tahun}`, { method: 'PUT', form: fd });
      toast(aksi === 'kirim' ? `Laporan PDF tahun ${tahun} berhasil dikirim dan tersimpan sebagai arsip.` : 'Draf laporan PDF disimpan.');
      setFile(null); setHapus(false); setKirim(false); setView(false); reload(); onSaved();
    } catch (x: any) { toast(x.message, false); } finally { setBusy(false); }
  };

  return (
    <section className="card-solid p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
        <div><h2 className="text-lg font-bold text-ink">Laporan Tahun {tahun}</h2><p className="mt-0.5 text-xs text-muted">Status: <LaporanBadge status={l.status} />{l.dikirim_at && ` · dikirim ${fmtDate(l.dikirim_at)}`}</p></div>
        {locked && <span className="flex items-center gap-1 text-xs font-semibold text-info"><Lock size={14} /> {l.status === 'selesai' ? 'Laporan selesai dan terkunci' : 'Menunggu verifikasi, laporan terkunci'}</span>}
      </div>

      {l.status === 'revisi' && l.catatan_admin && <p className="note-bad mt-4 !text-xs"><b>Admin meminta revisi:</b> {l.catatan_admin} Perbaiki file PDF lalu kirim kembali.</p>}
      {locked && <p className="note-info mt-4 !text-xs">{l.status === 'selesai' ? 'Laporan sudah diverifikasi admin dan berstatus Selesai.' : 'Laporan sudah dikirim dan menunggu verifikasi admin. Hubungi admin jika Anda perlu meminta revisi.'}</p>}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className={`drop md:col-span-2 ${file || l.ada_dok ? 'drop-on' : ''}`}>
          <label className="lbl" htmlFor="dokfile">File laporan kegiatan tahunan (PDF, maks. {maxMb} MB) <span className="text-bad">*</span></label>
          {!locked && <input id="dokfile" type="file" accept="application/pdf" className="w-full text-xs" onChange={(e) => { setFile(e.target.files?.[0] || null); setHapus(false); e.target.value = ''; }} />}
          {file && <p className="mt-1 text-xs text-muted">Akan diunggah: <b>{file.name}</b> ({fmtSize(file.size)}) <button type="button" className="text-bad underline" onClick={() => setFile(null)}>batal</button></p>}
          {!file && !!l.ada_dok && <div className="mt-1 flex flex-wrap items-center gap-3 text-xs"><span><FileText size={13} className="mr-1 inline text-bad" />Tersimpan: {l.dokumentasi_nama || 'laporan.pdf'}</span><a className="txt-link inline-flex items-center gap-1" href={`/api/portal/laporan/${tahun}/dokumentasi?dl=1`}><Download size={13} /> Unduh</a><button type="button" className="txt-link" onClick={() => setView(!view)}>{view ? 'Tutup PDF' : 'Lihat PDF'}</button>{!locked && <label className="flex items-center gap-1"><input type="checkbox" checked={hapus} onChange={(e) => setHapus(e.target.checked)} /> Ganti/hapus berkas saat menyimpan</label>}</div>}
          {!file && !l.ada_dok && <p className="mt-1 text-xs text-muted">Belum ada berkas. Susun seluruh isi laporan (rencana, pelaksanaan, biaya, sumber dana, dokumentasi, dan penutup) di dalam satu file PDF, lalu unggah di sini.</p>}
          {view && l.ada_dok && <iframe title={`Laporan ${tahun}`} src={`/api/portal/laporan/${tahun}/dokumentasi`} className="mt-3 h-[60vh] w-full rounded-xl border border-line bg-white" />}
        </div>
      </div>

      {!locked && <div className="sticky bottom-0 -mx-4 -mb-4 mt-6 flex flex-wrap justify-end gap-2 border-t border-line bg-surface px-4 py-3 sm:-mx-6 sm:-mb-6 sm:px-6">
        <button type="button" className="btn-o" disabled={busy} onClick={() => simpan('simpan')}><Save size={16} /> {busy ? 'Menyimpan…' : 'Simpan draf'}</button>
        <button type="button" className="btn-p" disabled={busy} onClick={() => setKirim(true)}><Send size={16} /> Kirim laporan</button>
      </div>}
      {locked && <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-ok"><CheckCircle2 size={17} /> {l.status === 'selesai' ? 'Laporan selesai tersimpan sebagai arsip.' : 'Arsip PDF tahun ini tersimpan dan menunggu verifikasi.'}</div>}

      {kirim && <Confirm title="Kirim laporan tahunan" text={`File PDF laporan tahun ${tahun} akan dikirim ke admin dan tidak dapat diubah sendiri setelahnya. Pastikan berkas sudah benar dan lengkap. Lanjutkan?`} onYes={() => simpan('kirim')} onNo={() => setKirim(false)} />}
    </section>
  );
}
