import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { api } from '../api';
import { ErrorBox, Modal, fmtDate, fmtSize, useFetch, useToast } from '../ui';

export function PendaftaranPage() {
  const toast = useToast(); const { data, error, reload } = useFetch<any[]>('/admin/pendaftaran');
  const [kat, setKat] = useState<Record<number, string>>({}); const [busy, setBusy] = useState(0); const [cred, setCred] = useState<any>(null);
  if (error) return <ErrorBox text={error} retry={reload} />;
  const approve = async (p: any) => {
    if (busy) return; setBusy(p.id);
    try { const r = await api('/admin/pendaftaran/' + p.id + '/approve', { method: 'POST', body: { kategori_nama: kat[p.id] ?? p.kategori_nama } }); setCred({ nama: p.nama_ormas, ...r }); reload(); }
    catch (x: any) { toast(x.message, false); } finally { setBusy(0); }
  };
  const reject = async (p: any) => {
    const catatan = window.prompt(`Tolak pendaftaran "${p.nama_ormas}"? Tulis alasan (opsional):`); if (catatan === null) return;
    try { await api('/admin/pendaftaran/' + p.id + '/reject', { method: 'POST', body: { catatan } }); toast('Pendaftaran ditolak'); reload(); } catch (x: any) { toast(x.message, false); }
  };
  const rows = (data || []);
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 font-serif text-2xl font-bold text-navy-900"><UserPlus /> Pendaftaran Ormas Baru</h1>
      {!rows.length && <p className="card p-6 text-sm text-slate-500">Belum ada pendaftaran baru.</p>}
      {rows.map((p) => (
        <div key={p.id} className={`card space-y-3 p-4 ${p.status === 'tindaklanjuti' ? 'border-l-4 border-l-gold-500' : 'opacity-70'}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-3">{p.has_logo && <img src={`/api/admin/pendaftaran/${p.id}/logo`} alt="" className="h-12 w-12 rounded object-cover" />}<div><h2 className="font-serif text-lg font-bold text-navy-900">{p.nama_ormas}</h2><p className="text-xs text-slate-500">Masuk {fmtDate(p.created_at)}</p></div></div>
            <span className={`rounded px-2 py-1 text-xs font-bold ${p.status === 'tindaklanjuti' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>{p.status === 'tindaklanjuti' ? 'Tindak lanjuti' : 'Ditolak'}</span>
          </div>
          <dl className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
            {([['Ketua', p.data.nama_ketua], ['Telepon/WA', p.data.nomor_whatsapp_ketua], ['Email', p.data.email_ormas], ['Bentuk', p.data.bentuk], ['Kemantren', p.data.kemantren], ['Bidang kegiatan', p.data.bidang_kegiatan], ['Alamat', p.data.alamat], ['Legal standing', [p.data.legal_jenis, p.data.nomor_sk, p.data.legal_tahun].filter(Boolean).join(' · ')], ['Jumlah anggota', p.data.anggota_total]] as [string, any][]).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="inline font-semibold text-slate-600">{k}: </dt><dd className="inline">{v}</dd></div>)}
          </dl>
          {p.docs.length > 0 && <div className="flex flex-wrap gap-2 text-xs">{p.docs.map((d: any) => <a key={d.id} className="btn-o" target="_blank" rel="noreferrer" href={`/api/admin/pendaftaran/${p.id}/dok/${d.id}`}>{d.jenis === 'dokumentasi' ? 'Laporan Kegiatan Tahunan' : d.jenis.replace(/_/g, ' ')} ({fmtSize(d.ukuran)})</a>)}</div>}
          {p.status === 'tindaklanjuti' ? (
            <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
              <div className="min-w-[14rem] flex-1"><label className="lbl" htmlFor={'k' + p.id}>Kategori (ubah bila perlu; kategori baru dibuat otomatis)</label><input id={'k' + p.id} className="inp" maxLength={100} value={kat[p.id] ?? p.kategori_nama} onChange={(e) => setKat((s) => ({ ...s, [p.id]: e.target.value }))} /></div>
              <button className="btn-p" disabled={busy === p.id} onClick={() => approve(p)}>{busy === p.id ? 'Memproses…' : 'Setujui'}</button>
              <button className="btn-o text-red-700" onClick={() => reject(p)}>Tolak</button>
            </div>
          ) : p.catatan && <p className="text-sm text-red-800">Alasan: {p.catatan}</p>}
        </div>
      ))}
      {cred && <Modal title="Pendaftaran disetujui" onClose={() => setCred(null)}>
        <div className="space-y-2 text-sm"><p><b>{cred.nama}</b> kini terdaftar sebagai <b>{cred.kode}</b> dan tampil di katalog. Foldernya dibuat di Google Drive (bila aktif).</p>
          <p className="rounded bg-amber-50 p-3">Akun portal ormas (tampil sekali, berikan ke ormas):<br />Username: <b>{cred.portal.username}</b><br />Password: <b>{cred.portal.password}</b></p></div>
      </Modal>}
    </div>
  );
}
