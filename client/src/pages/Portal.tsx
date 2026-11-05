import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ExternalLink, KeyRound, LogOut, Save } from 'lucide-react';
import { api } from '../api';
import { Badge, DOC_TYPES, ErrorBox, KEMANTREN, Modal, fmtDate, fmtSize, useFetch, useToast } from '../ui';
import { ChangePassword, PasswordInput, Shell } from './AdminAuth';

export function PortalLogin() {
  const nav = useNavigate(); const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => { e.preventDefault(); if (busy) return; setBusy(true); setErr(''); try { await api('/portal/login', { body: { username: u.trim(), password: p } }); nav('/portal'); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  return (
    <Shell title="Login Ormas">
      <p className="mb-4 rounded bg-navy-50 p-3 text-xs text-slate-700">Khusus untuk mengubah data dan dokumen ormas Anda sendiri. Username dan password ini <b>berbeda</b> dari password harian untuk membuka PDF terbatas.</p>
      <form onSubmit={go} className="space-y-4">
        <div><label className="lbl" htmlFor="pu">Username ormas</label><input id="pu" className="inp" autoComplete="username" placeholder="Contoh: ormas009" required value={u} onChange={(e) => setU(e.target.value)} /></div>
        <PasswordInput id="pp" label="Password" value={p} onChange={setP} />
        {err && <p className="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{err}</p>}
        <button className="btn-p w-full" disabled={busy}>{busy ? 'Memeriksa…' : 'Login'}</button>
        <Link to="/ormas-login/lupa" className="block text-center text-sm text-navy-700 hover:underline">Lupa Password?</Link>
      </form>
    </Shell>
  );
}

export function PortalForgot() {
  const [email, setEmail] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const go = async (e: React.FormEvent) => { e.preventDefault(); if (busy) return; setBusy(true); setErr(''); try { await api('/portal/forgot', { body: { email } }); setDone(true); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  return (
    <Shell title="Pemulihan Password Ormas">
      {done ? <p className="text-sm text-slate-700">Jika email tersebut terdaftar sebagai email ormas, tautan pemulihan sudah dikirim dan berlaku 30 menit. Periksa kotak masuk dan folder spam.</p> : (
        <form onSubmit={go} className="space-y-4"><div><label className="lbl" htmlFor="pe">Email ormas yang terdaftar</label><input id="pe" type="email" className="inp" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {err && <p className="text-sm text-red-700">{err}</p>}<button className="btn-p w-full" disabled={busy}>Kirim tautan pemulihan</button></form>)}
      <Link to="/ormas-login" className="mt-4 block text-center text-sm text-navy-700 hover:underline">Kembali ke login</Link>
    </Shell>
  );
}

export function PortalReset() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const toast = useToast();
  const [p, setP] = useState(''); const [c, setC] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return; if (p !== c) return setErr('Konfirmasi password tidak sama'); setBusy(true); setErr('');
    try { await api('/portal/reset', { body: { token: sp.get('token'), password: p } }); toast('Password berhasil diubah. Silakan login.'); nav('/ormas-login'); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Shell title="Buat Password Baru">
      <form onSubmit={go} className="space-y-4"><PasswordInput id="rp" label="Password baru (min. 8 karakter)" value={p} onChange={setP} /><PasswordInput id="rc" label="Konfirmasi password" value={c} onChange={setC} />
        {err && <p className="text-sm text-red-700">{err}</p>}<button className="btn-p w-full" disabled={busy}>Simpan password</button></form>
    </Shell>
  );
}

const KEYS = ['bentuk', 'bidang_kegiatan', 'kemantren', 'nama_ketua', 'sekretaris', 'bendahara', 'nomor_whatsapp_ketua', 'email_ormas', 'alamat', 'legal_jenis', 'nomor_sk', 'legal_tahun', 'legal_berlaku_sd', 'skto_nomor', 'skto_tahun', 'skto_berlaku_sd'];

export function PortalHome() {
  const nav = useNavigate(); const toast = useToast();
  const [me, setMe] = useState<any>(null); const [err, setErr] = useState('');
  const load = () => api('/portal/me').then(setMe).catch((e) => (e.status === 401 ? nav('/ormas-login', { replace: true }) : setErr(e.message)));
  useEffect(() => { load(); }, []);
  const { data: meta } = useFetch<any>('/public/meta');
  const [f, setF] = useState<any>({}); const [logo, setLogo] = useState<File | null>(null); const [rmLogo, setRmLogo] = useState(false);
  const [files, setFiles] = useState<Record<string, File>>({}); const [busy, setBusy] = useState(false); const [view, setView] = useState<any>(null); const [pw, setPw] = useState(false);
  useEffect(() => { if (me) setF(Object.fromEntries(KEYS.map((k) => [k, me[k] ?? '']))); }, [me]);
  if (err) return <div className="p-6"><ErrorBox text={err} retry={load} /></div>;
  if (!me) return <div className="grid min-h-screen place-items-center text-slate-500">Memuat…</div>;
  if (me.must_change) return <ChangePassword path="/portal/change-password" onDone={load} />;
  const maxMb = meta?.max_pdf_mb || 20;
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const T = (k: string, label: string, o: any = {}) => <div className={o.span ? 'md:col-span-2' : ''}><label className="lbl" htmlFor={k}>{label}</label><input id={k} type={o.type || 'text'} className="inp" placeholder={o.ph} maxLength={o.max} value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} /></div>;
  const H = (t: string) => <h3 className="border-b border-slate-200 pb-1 pt-2 font-serif font-bold text-navy-900 md:col-span-2">{t}</h3>;
  const pick = (j: string, x?: File) => {
    if (!x) return; if (x.type !== 'application/pdf') return toast(`"${x.name}" bukan PDF`, false); if (x.size > maxMb * 1048576) return toast(`"${x.name}" melebihi ${maxMb} MB`, false);
    setFiles((p) => ({ ...p, [j]: x }));
  };
  const logout = async () => { await api('/portal/logout', { method: 'POST', body: {} }).catch(() => {}); nav('/ormas-login'); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true);
    const fd = new FormData(); KEYS.forEach((k) => fd.append(k, String(f[k] ?? ''))); Object.entries(files).forEach(([j, x]) => fd.append(j, x)); if (logo) fd.append('logo', logo); if (rmLogo) fd.append('remove_logo', '1');
    try {
      const r = await api('/portal/profile', { method: 'PUT', form: fd });
      toast(r.changed ? 'Perubahan terkirim dan menunggu verifikasi admin. Katalog baru berubah setelah diverifikasi.' : 'Tidak ada perubahan untuk disimpan');
      setFiles({}); setLogo(null); setRmLogo(false); await load();
    } catch (x: any) { toast(x.message, false); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b-4 border-gold-500 bg-navy-900 text-white"><div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3"><Link to="/" className="font-serif text-lg font-bold">SIDOMAS · Portal Ormas</Link><div className="flex gap-2"><button className="btn bg-navy-700 text-white hover:bg-navy-600" onClick={() => setPw(true)}><KeyRound size={15} /> Ganti password</button><button className="btn-g" onClick={logout}><LogOut size={15} /> Keluar</button></div></div></header>
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <div className="card flex flex-wrap items-center gap-4 p-4">
          {me.has_logo ? <img src={`/api/logo/${me.kode_ormas}?${me.logo_pending ? 'pending=1&' : ''}v=${encodeURIComponent(me.updated_at)}`} alt="" className="h-16 w-16 rounded object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded bg-navy-50 text-navy-700"><Building2 /></span>}
          <div className="min-w-0 flex-1"><p className="text-sm text-slate-500">{me.kode_ormas} · {me.nama_kategori}</p><h1 className="font-serif text-xl font-bold text-navy-900">{me.nama_ormas}</h1><div className="mt-1 flex flex-wrap items-center gap-2 text-xs"><Badge s={me.status_dokumen} /><span className="text-slate-500">Diperbarui {fmtDate(me.updated_at)}</span></div></div>
        </div>
        {me.pending && <p className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><b>Perubahan Anda menunggu verifikasi admin.</b> Katalog publik dan penyimpanan dokumen masih memakai data lama sampai admin memverifikasinya. Anda masih bisa menyunting dan menyimpan ulang perubahan ini.</p>}
        {!me.pending && me.catatan_penolakan && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900"><b>Perubahan terakhir Anda ditolak admin.</b> {me.catatan_penolakan}</p>}
        <p className="rounded bg-amber-50 p-3 text-sm text-slate-700">Anda hanya dapat mengubah data ormas Anda sendiri. Setiap kali Anda menyimpan perubahan, status dokumen otomatis menjadi <b>Perlu Diverifikasi</b>, dan data baru tampil di katalog setelah admin memverifikasinya. Nama ormas, kategori, dan status hanya dapat diubah admin.</p>
        <form onSubmit={save} className="card grid gap-4 p-4 md:grid-cols-2">
          {H('Identitas')}
          {T('bentuk', 'Bentuk', { ph: 'Mis. Perkumpulan, Yayasan' })}
          <div><label className="lbl" htmlFor="km">Kemantren</label><select id="km" className="inp" value={f.kemantren ?? ''} onChange={(e) => set('kemantren', e.target.value)}><option value="">Pilih kemantren</option>{KEMANTREN.map((k) => <option key={k}>{k}</option>)}</select></div>
          {T('bidang_kegiatan', 'Bidang kegiatan', { span: true, max: 300 })}
          <div className="md:col-span-2"><label className="lbl" htmlFor="lg">Logo ormas</label><input id="lg" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => setLogo(e.target.files?.[0] || null)} />{me.has_logo && !logo && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" checked={rmLogo} onChange={(e) => setRmLogo(e.target.checked)} />Hapus logo saat ini</label>}</div>
          {H('Nama Pengurus')}
          {T('nama_ketua', 'Ketua')}{T('sekretaris', 'Sekretaris')}{T('bendahara', 'Bendahara')}{T('nomor_whatsapp_ketua', 'Nomor telepon / WhatsApp ketua', { type: 'tel', ph: '081234567890' })}
          {H('Kontak dan Alamat')}
          {T('email_ormas', 'Email ormas (dipakai untuk pemulihan password)', { type: 'email', span: true })}
          <div className="md:col-span-2"><label className="lbl" htmlFor="al">Alamat kantor / sekretariat <span className="font-normal text-slate-500">(tulis selengkap mungkin, dipakai untuk peta di halaman publik)</span></label><textarea id="al" rows={2} maxLength={500} className="inp" value={f.alamat ?? ''} onChange={(e) => set('alamat', e.target.value)} /></div>
          {H('Legal Standing')}
          {T('legal_jenis', 'Jenis')}{T('nomor_sk', 'Nomor')}{T('legal_tahun', 'Tahun', { max: 4, ph: '2021' })}{T('legal_berlaku_sd', 'Berlaku s/d')}
          {H('SKTO')}
          {T('skto_nomor', 'Nomor')}{T('skto_tahun', 'Tahun', { max: 4, ph: '2024' })}{T('skto_berlaku_sd', 'Berlaku s/d')}
          {H(`Dokumen PDF (maks. ${maxMb} MB per file)`)}
          <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
            {DOC_TYPES.map(([j, l]) => { const cur = me.docs.find((d: any) => d.jenis_dokumen === j); return (
              <div key={j} className={`rounded-md border p-3 ${files[j] || cur ? 'border-green-300 bg-green-50' : 'border-slate-200'}`}>
                <label className="lbl" htmlFor={'f_' + j}>{l}</label>
                <input id={'f_' + j} type="file" accept="application/pdf" className="w-full text-xs" onChange={(e) => { pick(j, e.target.files?.[0]); e.target.value = ''; }} />
                <p className="mt-1 text-xs text-slate-600">{files[j] ? <>Akan diunggah: <b>{files[j].name}</b> ({fmtSize(files[j].size)}) <button type="button" className="text-red-600 underline" onClick={() => setFiles((p) => { const n = { ...p }; delete n[j]; return n; })}>batal</button></> : cur ? <>Tersimpan: {cur.nama_file} ({fmtSize(cur.ukuran_file)}){cur.pending ? ' · menunggu verifikasi admin' : ''}. Pilih file baru untuk mengganti.</> : 'Belum diunggah'}</p>
                {cur && <button type="button" className="mt-1 text-xs font-semibold text-navy-700 underline" onClick={() => setView(view?.id === cur.id ? null : cur)}><ExternalLink size={12} className="mr-1 inline" />{view?.id === cur.id ? 'Tutup PDF' : 'Lihat PDF tersimpan'}</button>}
              </div>); })}
          </div>
          {view && <iframe title={view.nama_file} src={`/api/portal/files/${view.id}`} className="h-[60vh] w-full rounded border border-slate-300 md:col-span-2" />}
          <div className="flex justify-end md:col-span-2"><button className="btn-p" disabled={busy}><Save size={16} /> {busy ? 'Menyimpan…' : 'Simpan perubahan'}</button></div>
        </form>
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
        {err && <p className="text-sm text-red-700">{err}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn-o" onClick={onClose}>Batal</button><button className="btn-p" disabled={busy}>Simpan</button></div></form>
    </Modal>
  );
}
