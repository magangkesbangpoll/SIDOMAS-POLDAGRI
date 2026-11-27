import React, { useState } from 'react';
import { CheckCircle2, ClipboardCheck, Eye, Mail, MessageCircle, RotateCcw } from 'lucide-react';
import { api } from '../api';
import { Empty, ErrorBox, LegalBadge, Modal, WorkProgress, fmtDate, fmtSize, useFetch, useToast } from '../ui';

const warnaStatus = (s: string) => (s === 'disetujui' ? 'text-ok' : s === 'ditolak' || s === 'hangus' ? 'text-bad' : 'text-warn');

export function PendaftaranPage() {
  const toast = useToast();
  const { data, error, reload } = useFetch<any[]>('/admin/pendaftaran');
  const [kat, setKat] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(0);
  const [cred, setCred] = useState<any>(null);
  const [progress, setProgress] = useState('');
  const [review, setReview] = useState<any>(null);
  const [reviewItems, setReviewItems] = useState<Record<string, { status: string; catatan: string }>>({});
  const [catatan, setCatatan] = useState('');

  if (error) return <ErrorBox text={error} retry={reload} />;

  const approve = async (p: any, items?: { key: string; status: string; catatan: string }[]) => {
    if (busy) return; setBusy(p.id); setProgress(p.nama_ormas);
    try {
      const r = await api('/admin/pendaftaran/' + p.id + '/approve', { method: 'POST', body: { kategori_nama: kat[p.id] ?? p.kategori_nama, items } });
      setCred({ nama: p.nama_ormas, ...r }); reload();
    } catch (x: any) { toast(x.message, false); }
    finally { setBusy(0); setProgress(''); }
  };

  const reject = async (p: any) => {
    const alasan = window.prompt(`Tolak pendaftaran "${p.nama_ormas}"? Tulis alasan (opsional):`); if (alasan === null) return;
    try { await api('/admin/pendaftaran/' + p.id + '/reject', { method: 'POST', body: { catatan: alasan } }); toast('Pendaftaran ditolak'); reload(); }
    catch (x: any) { toast(x.message, false); }
  };

  const bukaReview = async (p: any) => {
    if (busy) return; setBusy(p.id);
    try {
      const d = await api<any>('/admin/pendaftaran/' + p.id);
      setReview(d); setCatatan(d.catatan_admin || '');
      setReviewItems(Object.fromEntries((d.items || []).map((i: any) => [i.key, { status: ['terverifikasi', 'revisi', 'pending'].includes(i.status) ? i.status : 'pending', catatan: i.catatan || '' }])));
    } catch (x: any) { toast(x.message, false); }
    finally { setBusy(0); }
  };

  const kembalikan = async () => {
    if (!review) return;
    setBusy(review.id); setProgress(review.nama_ormas);
    try {
      const items = Object.entries(reviewItems).map(([key, v]) => ({ key, status: v.status, catatan: v.status === 'revisi' ? v.catatan : '' }));
      const r = await api<any>('/admin/pendaftaran/' + review.id + '/kembalikan', { method: 'POST', body: { catatan, items } });
      toast(`Dikembalikan. Batas revisi ${fmtDate(r.batas_revisi)}`);
      setReview(null); reload();
    } catch (x: any) { toast(x.message, false); }
    finally { setBusy(0); setProgress(''); }
  };

  // Admin membuka berkas pendaftaran lewat endpoint admin (berdasar sesi admin),
  // bukan endpoint tracking publik yang memakai cookie OTP ormas.
  const urlBerkasReview = (it: any) => {
    if (!review) return '';
    if (it.key === 'logo') return `/api/admin/pendaftaran/${review.id}/logo`;
    return it.dokumen_id ? `/api/admin/pendaftaran/${review.id}/dok/${it.dokumen_id}` : '';
  };
  const pilihStatusItem = (key: string, status: string) =>
    setReviewItems((s) => ({ ...s, [key]: { status, catatan: s[key]?.catatan || '' } }));
  const kelasStatusItem = (aktif: boolean, status: string) => {
    if (!aktif) return 'btn-o py-1 text-xs';
    if (status === 'terverifikasi') return 'btn-p py-1 text-xs';
    if (status === 'revisi') return 'btn-d py-1 text-xs';
    return 'btn-o py-1 text-xs !border-gold/60 !bg-gold/10';
  };
  const semuaTerverifikasi = !!review?.items?.length && review.items.every((it: any) => reviewItems[it.key]?.status === 'terverifikasi');
  const setujuiDariReview = async () => {
    if (!review || !semuaTerverifikasi) return;
    const items = (review.items || []).map((it: any) => ({ key: it.key, status: 'terverifikasi', catatan: '' }));
    setReview(null);
    await approve(review, items);
  };

  const izinKhusus = async (p: any) => {
    if (!window.confirm(`Beri izin khusus pengajuan ulang untuk "${p.nama_ormas}"? Masa revisi 30 hari dibuka kembali.`)) return;
    try { await api('/admin/pendaftaran/' + p.id + '/izin-khusus', { method: 'POST', body: { catatan: 'Izin khusus dari admin' } }); toast('Izin khusus diberikan'); reload(); }
    catch (x: any) { toast(x.message, false); }
  };

  const kirimOtp = async (p: any, channel: 'email' | 'wa') => {
    const tujuan = channel === 'wa' ? 'WhatsApp pendaftar' : 'email pendaftar';
    if (!window.confirm(`Kirim ulang Kode OTP tracking untuk "${p.nama_ormas}" ke ${tujuan}?`)) return;
    try {
      const r = await api<{ message?: string }>('/admin/pendaftaran/' + p.id + '/otp', { method: 'POST', body: { channel } });
      toast(r.message || 'OTP dikirim.');
    } catch (x: any) { toast(x.message, false); }
  };

  const rows = data || [];
  return (
    <div className="stagger space-y-4">
      <div><p className="eyebrow">Antrean verifikasi</p><h1 className="page-title">Pendaftaran Ormas Baru</h1>
        <p className="page-sub">Periksa item, kembalikan untuk revisi dengan batas 30 hari, atau setujui pendaftaran.</p></div>
      {!rows.length && <div className="card"><Empty text="Belum ada pendaftaran baru." /></div>}
      {rows.map((p) => (
        <div key={p.id} className={`card-solid space-y-3 p-4 sm:p-5 ${p.status === 'tindaklanjuti' || p.status === 'hangus' ? '!border-gold/45' : 'opacity-80'}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-3">{p.has_logo && <img src={`/api/admin/pendaftaran/${p.id}/logo`} alt="" className="h-12 w-12 rounded object-cover" />}
              <div><h2 className="text-lg font-bold text-ink">{p.nama_ormas}</h2>
                <p className="text-xs text-muted">Masuk {fmtDate(p.created_at)}{p.tracking_id ? ` · Tracking ${p.tracking_id}` : ''}</p></div></div>
            <span className={`chip chip-dot ${warnaStatus(p.status)}`}>{p.status_label || (p.status === 'tindaklanjuti' ? 'Tindak lanjuti' : p.status)}</span>
          </div>
          {p.status === 'dikembalikan' && <p className="text-xs text-warn">Dikembalikan {fmtDate(p.tanggal_dikembalikan)} · batas revisi <b>{fmtDate(p.batas_revisi)}</b> · revisi ke-{p.revisi_count}</p>}
          {p.status === 'hangus' && <p className="text-xs text-bad">Batas revisi {fmtDate(p.batas_revisi)} terlampaui. Pengajuan hangus; admin masih dapat memberi izin khusus.</p>}
          <dl className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
            {([['Ketua', p.data.nama_ketua], ['Telepon pribadi ketua', p.data.nomor_whatsapp_ketua], ['Telepon ormas', p.data.telepon_ormas], ['Email', p.data.email_ormas], ['Bentuk', p.data.bentuk], ['Kemantren', p.data.kemantren], ['Bidang kegiatan', p.data.bidang_kegiatan], ['Alamat', p.data.alamat], ['Legal standing', <LegalBadge status={p.data.legal_status} />], ['Detail legal', p.data.legal_status === 'ya' ? [p.data.legal_jenis, p.data.nomor_sk, p.data.legal_tahun && `Tahun ${p.data.legal_tahun}`, p.data.legal_berlaku_sd && `s/d ${p.data.legal_berlaku_sd}`].filter(Boolean).join(' · ') : ''], ['Jumlah anggota', p.data.anggota_total]] as [string, any][]).filter(([, v]) => v !== '' && v != null).map(([k, v]) => <div key={k}><dt className="inline font-semibold text-muted">{k}: </dt><dd className="inline">{v}</dd></div>)}
          </dl>
          {p.docs.length > 0 && <div className="flex flex-wrap gap-2 text-xs">{p.docs.map((d: any) => <a key={d.id} className="btn-o" target="_blank" rel="noreferrer" href={`/api/admin/pendaftaran/${p.id}/dok/${d.id}`}>{d.jenis === 'dokumentasi' ? 'Laporan Kegiatan Tahunan' : d.jenis.replace(/_/g, ' ')} ({fmtSize(d.ukuran)})</a>)}</div>}
          {p.catatan && <p className="text-sm text-bad">Catatan: {p.catatan}</p>}
          <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
            <button className="btn-o" disabled={!!busy} onClick={() => bukaReview(p)}><Eye size={15} /> Periksa item</button>
            <button className="btn-o" disabled={!!busy} onClick={() => kirimOtp(p, 'email')}><Mail size={15} /> OTP Email</button>
            <button className="btn-o" disabled={!!busy} onClick={() => kirimOtp(p, 'wa')}><MessageCircle size={15} /> OTP WA</button>
            {p.status === 'hangus' && <button className="btn-g" disabled={!!busy} onClick={() => izinKhusus(p)}><RotateCcw size={15} /> Izin khusus</button>}
            {p.status === 'tindaklanjuti' && (
              <>
                <div className="min-w-[14rem] flex-1"><label className="lbl" htmlFor={'k' + p.id}>Kategori (ubah bila perlu)</label><input id={'k' + p.id} className="inp" maxLength={100} value={kat[p.id] ?? p.kategori_nama} onChange={(e) => setKat((s) => ({ ...s, [p.id]: e.target.value }))} /></div>
                <button className="btn-p" disabled={busy === p.id} onClick={() => approve(p)}>{busy === p.id ? 'Memproses…' : 'Setujui'}</button>
                <button className="btn-d" disabled={!!busy} onClick={() => reject(p)}>Tolak</button>
              </>
            )}
          </div>
        </div>
      ))}
      {progress && <WorkProgress title="Memproses pendaftaran ormas" subject={progress} />}

      {review && (
        <Modal title={`Periksa item — ${review.nama_ormas}`} wide onClose={() => setReview(null)}>
          <div className="space-y-4 text-sm">
            <p className="note-info"><ClipboardCheck size={15} className="mr-1 inline" /> Tandai item yang sudah benar sebagai <b>Terverifikasi</b>, atau beri tanda <b>Perlu revisi</b> disertai catatan. Bila <b>semua item terverifikasi</b>, tombol berubah menjadi <b>Setujui pendaftaran ormas</b>: berkas langsung diunggah ke Google Drive dan data ormas tampil di katalog. Item yang perlu revisi dibuka kembali maksimal 30 hari.</p>
            <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
              {(review.items || []).map((it: any) => {
                const v = reviewItems[it.key] || { status: it.status || 'pending', catatan: it.catatan || '' };
                return (
                  <div key={it.key} className="rounded-xl border border-line p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p className="font-semibold text-ink">{it.label}</p><p className="break-words text-xs text-muted">{it.nilai || '-'}</p></div>
                      {(urlBerkasReview(it) || it.url) && <a className="btn-o py-1 text-xs" href={urlBerkasReview(it) || `${it.url}?dl=1`} target="_blank" rel="noreferrer">Lihat berkas</a>}
                    </div>
                    <div className="mt-2">
                      <span className="lbl">Status item</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {[['pending', 'Belum diverifikasi'], ['terverifikasi', 'Terverifikasi (terkunci)'], ['revisi', 'Perlu revisi']].map(([st, lbl]) => (
                          <button key={st} type="button" aria-pressed={v.status === st} className={kelasStatusItem(v.status === st, st)} onClick={() => pilihStatusItem(it.key, st)}>{lbl}</button>
                        ))}
                      </div>
                    </div>
                    {v.status === 'revisi' && <div className="mt-2"><label className="lbl" htmlFor={'ct-' + it.key}>Catatan untuk ormas</label>
                      <textarea id={'ct-' + it.key} className="inp" rows={2} maxLength={900} placeholder="Jelaskan perbaikan yang diminta" value={v.catatan} onChange={(e) => setReviewItems((s) => ({ ...s, [it.key]: { ...v, catatan: e.target.value } }))} /></div>}
                  </div>
                );
              })}
            </div>
            <div><label className="lbl" htmlFor="cat-kembali">Catatan umum (opsional)</label>
              <textarea id="cat-kembali" className="inp" rows={3} maxLength={900} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Ringkasan yang akan tampil di halaman tracking ormas" /></div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3"><button className="btn-o" onClick={() => setReview(null)}>Batal</button>
              {semuaTerverifikasi
                ? <button className="btn-p" disabled={!!busy} onClick={setujuiDariReview}><CheckCircle2 size={15} /> Setujui pendaftaran ormas</button>
                : <button className="btn-d" disabled={!!busy} onClick={kembalikan}>Kembalikan untuk revisi</button>}
            </div>
          </div>
        </Modal>
      )}

      {cred && <Modal title="Pendaftaran disetujui" onClose={() => setCred(null)}>
        <div className="space-y-2 text-sm"><p><b>{cred.nama}</b> kini terdaftar sebagai <b>{cred.kode}</b> dan tampil di katalog. Foldernya dibuat di Google Drive (bila aktif).</p>
          {cred.tracking_id && <p>Tracking ID: <b className="mono">{cred.tracking_id}</b></p>}
          <p className="note-warn">Akun portal ormas (tampil sekali, berikan ke ormas):<br />Username: <b>{cred.portal.username}</b><br />Password: <b>{cred.portal.password}</b></p></div>
      </Modal>}
    </div>
  );
}
