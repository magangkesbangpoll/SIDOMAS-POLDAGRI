import React, { useState } from 'react';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Confirm, Empty, ErrorBox, Modal, NOTIF_KATEGORI, NotifKategoriBadge, Skeleton, fmtDate, useFetch, useToast } from '../ui';
import { useAuth } from './Admin';

export function AdminPengumumanPage() {
  const me = useAuth(); const toast = useToast();
  const { data, loading, error, reload } = useFetch<any>('/admin/pengumuman');
  const [form, setForm] = useState<any>(null); const [del, setDel] = useState<any>(null); const [busy, setBusy] = useState(false);
  const can = me.perms.includes('manage_ormas');
  const toggle = async (p: any) => {
    try { await api(`/admin/pengumuman/${p.id}`, { method: 'PUT', body: { aktif: !p.aktif } }); toast(p.aktif ? 'Pengumuman dinonaktifkan' : 'Pengumuman diaktifkan'); reload(); }
    catch (e: any) { toast(e.message, false); }
  };
  const remove = async () => {
    if (busy) return; setBusy(true);
    try { await api(`/admin/pengumuman/${del.id}`, { method: 'DELETE' }); toast('Pengumuman dihapus'); setDel(null); reload(); }
    catch (e: any) { toast(e.message, false); } finally { setBusy(false); }
  };
  return (
    <div className="stagger space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Informasi untuk ormas</p><h1 className="page-title">Pengumuman SIDOMAS</h1><p className="page-sub">Pengumuman aktif tampil pada dashboard seluruh ormas. Gunakan kategori untuk menandai tingkat urgensi.</p></div>
        {can && <button className="btn-p" onClick={() => setForm({ kategori: 'Information' })}><Plus size={16} /> Buat pengumuman</button>}</div>
      <div className="card-solid overflow-x-auto">
        {error ? <div className="p-4"><ErrorBox text={error} retry={reload} /></div> : loading && !data ? <Skeleton /> : !data?.items.length ? <Empty text="Belum ada pengumuman." /> : (
          <table className="tbl tbl-dense"><thead><tr>{['Judul', 'Kategori', 'Isi', 'Status', 'Dibuat', 'Aksi'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{data.items.map((p: any) => <tr key={p.id}>
              <td data-label="Judul" className="td min-w-[160px] font-semibold">{p.judul}</td>
              <td data-label="Kategori" className="td"><NotifKategoriBadge kategori={p.kategori} /></td>
              <td data-label="Isi" className="td max-w-[26rem] text-xs text-muted [overflow-wrap:anywhere]">{p.pesan}</td>
              <td data-label="Status" className="td"><span className={`chip chip-dot ${p.aktif ? 'text-ok' : 'text-muted'}`}>{p.aktif ? 'Aktif' : 'Nonaktif'}</span></td>
              <td data-label="Dibuat" className="td text-xs">{fmtDate(p.created_at)}</td>
              <td data-label="Aksi" className="td"><div className="flex flex-wrap gap-1.5">
                {can && <><button className="icon-btn" title={p.aktif ? 'Nonaktifkan' : 'Aktifkan'} aria-label={p.aktif ? 'Nonaktifkan pengumuman' : 'Aktifkan pengumuman'} onClick={() => toggle(p)}><Megaphone size={15} /></button>
                  <button className="icon-btn hover:!border-bad/50 hover:!text-bad" title="Hapus" aria-label="Hapus pengumuman" onClick={() => setDel(p)}><Trash2 size={15} /></button></>}
              </div></td>
            </tr>)}</tbody></table>
        )}
      </div>
      {form && <PengumumanForm item={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} />}
      {del && <Confirm danger title="Hapus pengumuman" text={`Hapus pengumuman "${del.judul}" secara permanen? Pengumuman ini akan hilang juga dari dashboard ormas.`} onYes={remove} onNo={() => setDel(null)} />}
    </div>
  );
}

function PengumumanForm({ item, onClose, onSaved }: any) {
  const toast = useToast();
  const [f, setF] = useState({ judul: item.judul || '', pesan: item.pesan || '', kategori: item.kategori || 'Information' });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    if (f.judul.trim().length < 3 || f.pesan.trim().length < 3) return toast('Judul dan isi minimal 3 karakter', false);
    setBusy(true);
    try { await api('/admin/pengumuman', { method: 'POST', body: f }); toast('Pengumuman diterbitkan'); onSaved(); }
    catch (x: any) { toast(x.message, false); } finally { setBusy(false); }
  };
  return (
    <Modal title="Buat pengumuman" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="lbl" htmlFor="pjud">Judul</label><input id="pjud" className="inp" maxLength={150} required autoFocus value={f.judul} onChange={(e) => set('judul', e.target.value)} /></div>
        <div><label className="lbl" htmlFor="pkat">Kategori</label><select id="pkat" className="inp" value={f.kategori} onChange={(e) => set('kategori', e.target.value)}>{NOTIF_KATEGORI.map((k) => <option key={k}>{k}</option>)}</select></div>
        <div><label className="lbl" htmlFor="ppes">Isi pengumuman</label><textarea id="ppes" className="inp" rows={5} maxLength={1000} required value={f.pesan} onChange={(e) => set('pesan', e.target.value)} /></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-o" onClick={onClose}>Batal</button><button className="btn-p" disabled={busy}>{busy ? 'Menerbitkan…' : 'Terbitkan'}</button></div>
      </form>
    </Modal>
  );
}
