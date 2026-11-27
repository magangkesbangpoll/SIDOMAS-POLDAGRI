import React, { useEffect, useState } from 'react';
import { Download, Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Badge, Confirm, DOC_STATUS, Empty, ErrorBox, Modal, Pager, Skeleton, fmtDate, qs, useDebounced, useFetch, useToast } from '../ui';
import { useAuth } from './Admin';
import { CategoryManager } from './CategoryManager';

export function AdminsPage() {
  const toast = useToast(); const me = useAuth(); const { data, loading, error, reload } = useFetch<any>('/admin/accounts'); const [form, setForm] = useState<any>(null); const [del, setDel] = useState<any>(null);
  const remove = async () => { try { await api(`/admin/accounts/${del.id}`, { method: 'DELETE' }); toast('Akun dihapus'); setDel(null); reload(); } catch (e: any) { toast(e.message, false); setDel(null); } };
  return (
    <div className="stagger space-y-4">
      <div className="flex items-center justify-between"><div><p className="eyebrow">Hak akses</p><h1 className="page-title">Manajemen Admin</h1></div><button className="btn-p" onClick={() => setForm({})}><Plus size={16} /> Tambah Admin</button></div>
      <div className="card-solid overflow-x-auto">{error ? <div className="p-4"><ErrorBox text={error} retry={reload} /></div> : loading && !data ? <Skeleton /> : (
        <table className="tbl"><thead><tr>{['Nama', 'Username', 'Email', 'Role', 'Status', 'Login Terakhir', 'Aksi'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{data.items.map((a: any) => <tr key={a.id}><td data-label="Nama" className="td"><div>{a.nama}</div></td><td data-label="Username" className="td"><div>{a.username}</div></td><td data-label="Email" className="td"><div>{a.email}</div></td><td data-label="Role" className="td"><div>{a.nama_role}</div></td><td data-label="Status" className="td"><div><Badge s={a.status_akun === 'aktif' ? 'Lengkap' : 'Tidak Berlaku'} label={a.status_akun === 'aktif' ? 'Aktif' : 'Nonaktif'} /></div></td><td data-label="Login terakhir" className="td"><div>{fmtDate(a.last_login)}</div></td><td data-label="Aksi" className="td"><div><button className="btn-o px-2 py-1" aria-label="Edit akun" onClick={() => setForm(a)}><Pencil size={14} /></button>{a.id !== me.id && <button className="btn-o ml-1 px-2 py-1 text-bad" aria-label="Hapus akun" title="Hapus akun" onClick={() => setDel(a)}><Trash2 size={14} /></button>}</div></td></tr>)}</tbody></table>)}</div>
      {del && <Confirm danger title="Hapus akun admin" text={`Hapus akun "${del.username}" (${del.nama}) secara permanen? Riwayat aktivitasnya tetap ada di log. Jika Anda hanya ingin menutup akses sementara, gunakan status Nonaktif pada menu edit.`} onYes={remove} onNo={() => setDel(null)} />}
      {form && <AdminForm item={form} roles={data?.roles || []} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} toast={toast} />}
    </div>
  );
}
function AdminForm({ item, roles, onClose, onSaved, toast }: any) {
  const edit = !!item.id; const [f, setF] = useState({ nama: item.nama || '', username: item.username || '', email: item.email || '', role_id: item.role_id || roles[0]?.id || '', status_akun: item.status_akun || 'aktif', password: '' }); const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const submit = async (e: React.FormEvent) => { e.preventDefault(); if (busy) return; setBusy(true); try { await api(edit ? `/admin/accounts/${item.id}` : '/admin/accounts', { method: edit ? 'PUT' : 'POST', body: f }); toast('Akun disimpan'); onSaved(); } catch (x: any) { toast(x.message, false); setBusy(false); } };
  return (
    <Modal title={edit ? 'Edit Akun Admin' : 'Tambah Akun Admin'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="lbl" htmlFor="an">Nama lengkap</label><input id="an" className="inp" required value={f.nama} onChange={(e) => set('nama', e.target.value)} /></div>
        <div><label className="lbl" htmlFor="au">Username</label><input id="au" className="inp" required disabled={edit} value={f.username} onChange={(e) => set('username', e.target.value)} /></div>
        <div><label className="lbl" htmlFor="ae">Email</label><input id="ae" type="email" className="inp" required value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div><label className="lbl" htmlFor="ar">Role</label><select id="ar" className="inp" value={f.role_id} onChange={(e) => set('role_id', e.target.value)}>{roles.map((r: any) => <option key={r.id} value={r.id}>{r.nama_role}</option>)}</select></div>
        {edit && <div><label className="lbl" htmlFor="as">Status akun</label><select id="as" className="inp" value={f.status_akun} onChange={(e) => set('status_akun', e.target.value)}><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></select></div>}
        <div><label className="lbl" htmlFor="ap">{edit ? 'Reset password (kosongkan jika tidak diubah)' : 'Password awal (min. 8 karakter)'}</label><input id="ap" type="password" className="inp" autoComplete="new-password" required={!edit} value={f.password} onChange={(e) => set('password', e.target.value)} /><p className="mt-1 text-xs text-muted">Pengguna wajib menggantinya saat login pertama.</p></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-o" onClick={onClose}>Batal</button><button className="btn-p" disabled={busy}>Simpan</button></div>
      </form>
    </Modal>
  );
}

export function ExportPage() {
  const { data: meta } = useFetch<any>('/public/meta'); const [kat, setKat] = useState(''); const [sd, setSd] = useState(''); const [so, setSo] = useState(''); const [lg, setLg] = useState(''); const [q, setQ] = useState('');
  return (
    <div className="stagger space-y-4">
      <div><p className="eyebrow">Laporan</p><h1 className="page-title">Ekspor Data</h1></div>
      <div className="card space-y-3 p-4">
        <h2 className="font-semibold">Ekspor data ormas (Excel siap cetak)</h2><p className="text-sm text-muted">Kosongkan semua filter untuk mengekspor seluruh data. File Excel (.xlsx) sudah rapi: judul, header berwarna, lebar kolom otomatis, garis tabel, dan diatur untuk cetak kertas landscape A3. Isi PDF tidak ikut diekspor.</p>
        <div className="grid gap-3 md:grid-cols-4">
          <input className="inp" placeholder="Kata kunci pencarian" aria-label="Pencarian" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="inp" aria-label="Kategori" value={kat} onChange={(e) => setKat(e.target.value)}><option value="">Semua kategori</option>{meta?.categories.map((c: any) => <option key={c.id} value={c.id}>{c.nama_kategori}</option>)}</select>
          <select className="inp" aria-label="Status dokumen" value={sd} onChange={(e) => setSd(e.target.value)}><option value="">Semua status dokumen</option>{DOC_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
          <select className="inp" aria-label="Status operasional" value={so} onChange={(e) => setSo(e.target.value)}><option value="">Semua status operasional</option><option>Aktif</option><option>Tidak Aktif</option></select>
          <select className="inp" aria-label="Status Legal Standing" value={lg} onChange={(e) => setLg(e.target.value)}><option value="">Semua Legal Standing</option><option value="ya">Sudah memiliki</option><option value="tidak">Tidak memiliki</option><option value="belum">Belum dijawab</option></select>
        </div>
        <a className="btn-p" href={`/api/admin/export/ormas?${qs({ q, kategori_id: kat, status_dokumen: sd, status_operasional: so, legal_status: lg })}`}><Download size={16} /> Unduh Excel</a>
      </div>
    </div>
  );
}

export function LogsPage() {
  const [q, setQ] = useState(''); const [page, setPage] = useState(1); const dq = useDebounced(q); useEffect(() => setPage(1), [dq]);
  const { data, loading, error, reload } = useFetch<any>('/admin/logs?' + qs({ q: dq, page }));
  return (
    <div className="stagger space-y-4">
      <div><p className="eyebrow">Jejak audit</p><h1 className="page-title">Log Aktivitas</h1></div>
      <input className="inp max-w-sm" placeholder="Cari pengguna, jenis, atau ringkasan" aria-label="Cari log" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card-solid overflow-x-auto">{error ? <div className="p-4"><ErrorBox text={error} retry={reload} /></div> : loading && !data ? <Skeleton /> : !data.items.length ? <Empty text="Belum ada aktivitas." /> : (
        <table className="tbl"><thead><tr>{['Waktu', 'Pengguna', 'Role', 'Aktivitas', 'ID Ormas', 'Ringkasan', 'Hasil'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{data.items.map((l: any) => <tr key={l.id}><td data-label="Waktu" className="td whitespace-nowrap"><div>{fmtDate(l.waktu_aktivitas)}</div></td><td data-label="Pengguna" className="td"><div>{l.nama_pengguna}</div></td><td data-label="Role" className="td"><div>{l.role}</div></td><td data-label="Aktivitas" className="td"><div>{l.jenis_aktivitas}</div></td><td data-label="ID Ormas" className="td"><div>{l.kode_ormas || '-'}</div></td><td data-label="Ringkasan" className="td min-w-[240px]"><div>{l.ringkasan}</div></td><td data-label="Hasil" className="td"><div><Badge s={l.hasil === 'berhasil' ? 'Lengkap' : 'Kedaluwarsa'} label={l.hasil === 'berhasil' ? 'Berhasil' : 'Gagal'} /></div></td></tr>)}</tbody></table>)}</div>
      {data && <Pager page={page} total={data.total} size={25} onPage={setPage} />}
    </div>
  );
}

export function SettingsPage() {
  const toast = useToast(); const { data, loading, error, reload } = useFetch<any>('/admin/settings'); const [s, setS] = useState<any>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setS({ ...data.settings, catalog_public: data.settings.catalog_public === 'true' }); }, [data]);
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (loading || !s) return <Skeleton />;
  const set = (k: string, v: any) => setS((p: any) => ({ ...p, [k]: v }));
  const save = async (e: React.FormEvent) => { e.preventDefault(); if (busy) return; setBusy(true); try { await api('/admin/settings', { method: 'PUT', body: s }); toast('Pengaturan disimpan'); reload(); } catch (x: any) { toast(x.message, false); } finally { setBusy(false); } };
  const F = (k: string, label: string, type = 'text') => <div><label className="lbl" htmlFor={k}>{label}</label><input id={k} type={type} className="inp" value={s[k]} onChange={(e) => set(k, e.target.value)} /></div>;
  return (
    <div className="stagger space-y-5">
      <div><p className="eyebrow">Sistem</p><h1 className="page-title">Pengaturan</h1></div>
      <form onSubmit={save} className="card grid gap-4 p-4 md:grid-cols-2">
        {F('app_name', 'Nama aplikasi')}{F('recovery_from', 'Email pengirim pemulihan password', 'email')}{F('max_pdf_mb', 'Batas ukuran PDF (MB)', 'number')}{F('max_pdf_count', 'Maksimal dokumen per ormas', 'number')}{F('session_minutes', 'Masa sesi admin (menit)', 'number')}{F('login_max_attempts', 'Batas percobaan login per 15 menit', 'number')}
        <div><span className="lbl">Zona waktu aplikasi</span><div className="readonly">{data.timezone} (tetap)</div></div>
        <label className="flex items-center gap-2 self-end text-sm font-semibold"><input type="checkbox" checked={s.catalog_public} onChange={(e) => set('catalog_public', e.target.checked)} />Tampilkan katalog ormas ke publik</label>
        <div className="md:col-span-2 text-right"><button className="btn-p" disabled={busy}>Simpan pengaturan</button></div>
      </form>
      <CategoryManager initial={data.categories} onSaved={reload} />
    </div>
  );
}
