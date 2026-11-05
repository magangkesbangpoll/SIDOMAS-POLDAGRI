import React, { useEffect, useState } from 'react';
import { AlertTriangle, Copy, Download, Eye, EyeOff, Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Badge, Confirm, DOC_STATUS, Empty, ErrorBox, Modal, Pager, Skeleton, fmtDate, qs, useDebounced, useFetch, useToast } from '../ui';
import { useAuth } from './Admin';
import { CategoryManager } from './CategoryManager';

export function CredentialsPage() {
  const me = useAuth(); const toast = useToast();
  const { data, loading, error, reload } = useFetch<any>('/admin/credentials'); const { data: meta } = useFetch<any>('/public/meta');
  const [q, setQ] = useState(''); const [kat, setKat] = useState(''); const [st, setSt] = useState(''); const [pw, setPw] = useState<Record<number, string>>({}); const [regen, setRegen] = useState<any>(null);
  const can = me.perms.includes('manage_credentials');
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast('Disalin ke clipboard'); } catch { toast('Gagal menyalin', false); } };
  const reveal = async (id: number) => { if (pw[id]) return setPw((p) => { const n = { ...p }; delete n[id]; return n; }); try { const r = await api(`/admin/credentials/${id}/reveal`); setPw((p) => ({ ...p, [id]: r.password })); } catch (e: any) { toast(e.message, false); } };
  const copyPw = async (id: number) => { try { const r = await api(`/admin/credentials/${id}/reveal`); await copy(r.password); } catch (e: any) { toast(e.message, false); } };
  const doRegen = async () => { try { const r = await api(`/admin/credentials/${regen.id}/regenerate`, { method: 'POST', body: {} }); setPw((p) => ({ ...p, [regen.id]: r.password })); toast('Kredensial dibuat ulang'); setRegen(null); reload(); } catch (e: any) { toast(e.message, false); } };
  const rows = (data?.items || []).filter((r: any) => (!q || (r.nama_ormas + r.kode_ormas).toLowerCase().includes(q.toLowerCase())) && (!kat || r.nama_kategori === kat) && (!st || r.status === st));
  const hoursLeft = (r: any) => (new Date(r.tanggal_kedaluwarsa).getTime() - new Date(data.server_time).getTime()) / 3600000;
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl font-bold text-navy-900">Password Harian</h1>
      <p className="text-sm text-slate-600">Kredensial berganti otomatis setiap pukul 00.00 WIB. Berikan username dan password hari ini kepada pihak yang berhak mengakses dokumen ormas terkait.</p>
      <div className="card grid gap-3 p-3 md:grid-cols-3">
        <input className="inp" placeholder="Cari nama ormas atau ID" aria-label="Cari" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="inp" aria-label="Kategori" value={kat} onChange={(e) => setKat(e.target.value)}><option value="">Semua kategori</option>{meta?.categories.map((c: any) => <option key={c.id}>{c.nama_kategori}</option>)}</select>
        <select className="inp" aria-label="Status" value={st} onChange={(e) => setSt(e.target.value)}><option value="">Semua status kredensial</option><option value="aktif">Aktif</option><option value="kedaluwarsa">Kedaluwarsa</option></select>
      </div>
      <div className="card overflow-x-auto">
        {error ? <div className="p-4"><ErrorBox text={error} retry={reload} /></div> : loading && !data ? <Skeleton /> : !rows.length ? <Empty text="Tidak ada data." /> : (
          <table className="w-full"><thead className="border-b bg-slate-50"><tr>{['ID Ormas', 'Nama Ormas', 'Kategori', 'Username Hari Ini', 'Password Hari Ini', 'Tanggal Berlaku', 'Kedaluwarsa', 'Status', 'Aksi'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((r: any) => (
              <tr key={r.id}><td className="td font-semibold">{r.kode_ormas}</td><td className="td min-w-[200px]">{r.nama_ormas}</td><td className="td">{r.nama_kategori}</td>
                <td className="td font-mono">{r.username || '-'} {r.username && <button className="ml-1 text-slate-500" title="Salin username" aria-label="Salin username" onClick={() => copy(r.username)}><Copy size={14} className="inline" /></button>}</td>
                <td className="td font-mono">{pw[r.id] || '••••••••••'}{can && <><button className="ml-2 text-slate-500" title={pw[r.id] ? 'Sembunyikan' : 'Tampilkan'} aria-label="Tampilkan atau sembunyikan password" onClick={() => reveal(r.id)}>{pw[r.id] ? <EyeOff size={14} className="inline" /> : <Eye size={14} className="inline" />}</button><button className="ml-1 text-slate-500" title="Salin password" aria-label="Salin password" onClick={() => copyPw(r.id)}><Copy size={14} className="inline" /></button></>}</td>
                <td className="td">{r.tanggal_berlaku}</td><td className="td">{fmtDate(r.tanggal_kedaluwarsa)}{r.status === 'aktif' && hoursLeft(r) < 3 && <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-orange-600"><AlertTriangle size={12} /> Segera berakhir</span>}</td>
                <td className="td"><Badge s={r.status === 'aktif' ? 'Lengkap' : 'Kedaluwarsa'} /></td>
                <td className="td">{can && <button className="btn-o px-2 py-1" title="Regenerasi" aria-label="Regenerasi kredensial" onClick={() => setRegen(r)}><RefreshCw size={14} /></button>}</td></tr>))}</tbody></table>)}
      </div>
      {regen && <Confirm title="Regenerasi kredensial" text={`Buat username dan password baru untuk ${regen.kode_ormas}? Kredensial hari ini yang lama langsung tidak berlaku.`} onYes={doRegen} onNo={() => setRegen(null)} />}
    </div>
  );
}

export function AdminsPage() {
  const toast = useToast(); const me = useAuth(); const { data, loading, error, reload } = useFetch<any>('/admin/accounts'); const [form, setForm] = useState<any>(null); const [del, setDel] = useState<any>(null);
  const remove = async () => { try { await api(`/admin/accounts/${del.id}`, { method: 'DELETE' }); toast('Akun dihapus'); setDel(null); reload(); } catch (e: any) { toast(e.message, false); setDel(null); } };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="font-serif text-2xl font-bold text-navy-900">Manajemen Admin</h1><button className="btn-p" onClick={() => setForm({})}><Plus size={16} /> Tambah Admin</button></div>
      <div className="card overflow-x-auto">{error ? <div className="p-4"><ErrorBox text={error} retry={reload} /></div> : loading && !data ? <Skeleton /> : (
        <table className="w-full"><thead className="border-b bg-slate-50"><tr>{['Nama', 'Username', 'Email', 'Role', 'Status', 'Login Terakhir', 'Aksi'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{data.items.map((a: any) => <tr key={a.id}><td className="td">{a.nama}</td><td className="td">{a.username}</td><td className="td">{a.email}</td><td className="td">{a.nama_role}</td><td className="td"><Badge s={a.status_akun === 'aktif' ? 'Lengkap' : 'Tidak Berlaku'} /></td><td className="td">{fmtDate(a.last_login)}</td><td className="td"><button className="btn-o px-2 py-1" aria-label="Edit akun" onClick={() => setForm(a)}><Pencil size={14} /></button>{a.id !== me.id && <button className="btn-o ml-1 px-2 py-1 text-red-600" aria-label="Hapus akun" title="Hapus akun" onClick={() => setDel(a)}><Trash2 size={14} /></button>}</td></tr>)}</tbody></table>)}</div>
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
        <div><label className="lbl" htmlFor="ap">{edit ? 'Reset password (kosongkan jika tidak diubah)' : 'Password awal (min. 8 karakter)'}</label><input id="ap" type="password" className="inp" autoComplete="new-password" required={!edit} value={f.password} onChange={(e) => set('password', e.target.value)} /><p className="mt-1 text-xs text-slate-500">Pengguna wajib menggantinya saat login pertama.</p></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-o" onClick={onClose}>Batal</button><button className="btn-p" disabled={busy}>Simpan</button></div>
      </form>
    </Modal>
  );
}

export function ExportPage() {
  const me = useAuth(); const { data: meta } = useFetch<any>('/public/meta'); const [kat, setKat] = useState(''); const [sd, setSd] = useState(''); const [so, setSo] = useState(''); const [q, setQ] = useState(''); const [ok, setOk] = useState(false);
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl font-bold text-navy-900">Ekspor Data</h1>
      <div className="card space-y-3 p-4">
        <h2 className="font-semibold">Ekspor data ormas (CSV)</h2><p className="text-sm text-slate-600">Kosongkan semua filter untuk mengekspor seluruh data. File berformat UTF-8 sehingga terbaca benar di Excel. Isi PDF dan password tidak ikut diekspor.</p>
        <div className="grid gap-3 md:grid-cols-4">
          <input className="inp" placeholder="Kata kunci pencarian" aria-label="Pencarian" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="inp" aria-label="Kategori" value={kat} onChange={(e) => setKat(e.target.value)}><option value="">Semua kategori</option>{meta?.categories.map((c: any) => <option key={c.id} value={c.id}>{c.nama_kategori}</option>)}</select>
          <select className="inp" aria-label="Status dokumen" value={sd} onChange={(e) => setSd(e.target.value)}><option value="">Semua status dokumen</option>{DOC_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
          <select className="inp" aria-label="Status operasional" value={so} onChange={(e) => setSo(e.target.value)}><option value="">Semua status operasional</option><option>Aktif</option><option>Tidak Aktif</option></select>
        </div>
        <a className="btn-p" href={`/api/admin/export/ormas?${qs({ q, kategori_id: kat, status_dokumen: sd, status_operasional: so })}`}><Download size={16} /> Unduh CSV</a>
      </div>
      {me.perms.includes('export_credentials') && (
        <div className="card space-y-3 border-orange-300 p-4"><h2 className="flex items-center gap-2 font-semibold text-orange-700"><AlertTriangle size={18} /> Ekspor daftar username dan password harian</h2>
          <p className="text-sm text-slate-600">Berkas ini berisi data rahasia. Aktivitas ini dicatat di log. Simpan dengan aman dan hapus setelah digunakan.</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />Saya memahami berkas ini bersifat rahasia</label>
          <a className={`btn-d ${ok ? '' : 'pointer-events-none opacity-50'}`} aria-disabled={!ok} href="/api/admin/export/credentials?confirm=yes"><Download size={16} /> Unduh kredensial</a></div>)}
    </div>
  );
}

export function LogsPage() {
  const [q, setQ] = useState(''); const [page, setPage] = useState(1); const dq = useDebounced(q); useEffect(() => setPage(1), [dq]);
  const { data, loading, error, reload } = useFetch<any>('/admin/logs?' + qs({ q: dq, page }));
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl font-bold text-navy-900">Log Aktivitas</h1>
      <input className="inp max-w-sm" placeholder="Cari pengguna, jenis, atau ringkasan" aria-label="Cari log" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card overflow-x-auto">{error ? <div className="p-4"><ErrorBox text={error} retry={reload} /></div> : loading && !data ? <Skeleton /> : !data.items.length ? <Empty text="Belum ada aktivitas." /> : (
        <table className="w-full"><thead className="border-b bg-slate-50"><tr>{['Waktu', 'Pengguna', 'Role', 'Aktivitas', 'ID Ormas', 'Ringkasan', 'Hasil'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{data.items.map((l: any) => <tr key={l.id}><td className="td whitespace-nowrap">{fmtDate(l.waktu_aktivitas)}</td><td className="td">{l.nama_pengguna}</td><td className="td">{l.role}</td><td className="td">{l.jenis_aktivitas}</td><td className="td">{l.kode_ormas || '-'}</td><td className="td min-w-[240px]">{l.ringkasan}</td><td className="td"><Badge s={l.hasil === 'berhasil' ? 'Lengkap' : 'Kedaluwarsa'} /></td></tr>)}</tbody></table>)}</div>
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
    <div className="space-y-5">
      <h1 className="font-serif text-2xl font-bold text-navy-900">Pengaturan</h1>
      <form onSubmit={save} className="card grid gap-4 p-4 md:grid-cols-2">
        {F('app_name', 'Nama aplikasi')}{F('recovery_from', 'Email pengirim pemulihan password', 'email')}{F('max_pdf_mb', 'Batas ukuran PDF (MB)', 'number')}{F('max_pdf_count', 'Maksimal dokumen per ormas', 'number')}{F('session_minutes', 'Masa sesi admin (menit)', 'number')}{F('login_max_attempts', 'Batas percobaan login per 15 menit', 'number')}
        <div><span className="lbl">Zona waktu kredensial harian</span><div className="rounded bg-slate-100 px-3 py-2 text-sm">{data.timezone} (tetap)</div></div>
        <label className="flex items-center gap-2 self-end text-sm font-semibold"><input type="checkbox" checked={s.catalog_public} onChange={(e) => set('catalog_public', e.target.checked)} />Tampilkan katalog ormas ke publik</label>
        <div className="md:col-span-2 text-right"><button className="btn-p" disabled={busy}>Simpan pengaturan</button></div>
      </form>
      <CategoryManager initial={data.categories} onSaved={reload} />
    </div>
  );
}
