import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Eye, EyeOff } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../ui';

export const Shell = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="grid min-h-screen place-items-center bg-navy-900 p-4">
    <div className="card w-full max-w-sm p-6">
      <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded bg-gold-500 text-navy-900"><Building2 size={20} /></span><div><p className="font-serif text-lg font-bold leading-tight text-navy-900">SIDOMAS</p><p className="text-xs text-slate-500">{title}</p></div></div>
      {children}
      <Link to="/" className="mt-5 block text-center text-xs text-slate-500 hover:underline">← Kembali ke halaman publik</Link>
    </div>
  </div>
);
export const PasswordInput = ({ id, value, onChange, label }: any) => {
  const [show, setShow] = useState(false);
  return (<div><label className="lbl" htmlFor={id}>{label}</label><div className="relative"><input id={id} type={show ? 'text' : 'password'} className="inp pr-10" required value={value} onChange={(e) => onChange(e.target.value)} /><button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-2 text-slate-500" aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>);
};

export function Login() {
  const nav = useNavigate(); const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => { e.preventDefault(); if (busy) return; setBusy(true); setErr(''); try { await api('/auth/login', { body: { username: u.trim(), password: p } }); nav('/admin'); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  return (
    <Shell title="Login Admin">
      <form onSubmit={go} className="space-y-4">
        <div><label className="lbl" htmlFor="lu">Username</label><input id="lu" className="inp" autoComplete="username" required value={u} onChange={(e) => setU(e.target.value)} /></div>
        <PasswordInput id="lp" label="Password" value={p} onChange={setP} />
        {err && <p className="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{err}</p>}
        <button className="btn-p w-full" disabled={busy}>{busy ? 'Memeriksa…' : 'Login'}</button>
        <Link to="/admin/forgot" className="block text-center text-sm text-navy-700 hover:underline">Lupa Password?</Link>
      </form>
    </Shell>
  );
}

export function Forgot() {
  const [email, setEmail] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const go = async (e: React.FormEvent) => { e.preventDefault(); if (busy) return; setBusy(true); setErr(''); try { await api('/auth/forgot', { body: { email } }); setDone(true); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  return (
    <Shell title="Pemulihan Password">
      {done ? <p className="text-sm text-slate-700">Jika email terdaftar, tautan pemulihan sudah dikirim dan berlaku 30 menit. Periksa kotak masuk Anda.</p> : (
        <form onSubmit={go} className="space-y-4"><div><label className="lbl" htmlFor="fe">Email terdaftar</label><input id="fe" type="email" className="inp" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {err && <p className="text-sm text-red-700">{err}</p>}<button className="btn-p w-full" disabled={busy}>Kirim tautan pemulihan</button></form>)}
      <Link to="/admin/login" className="mt-4 block text-center text-sm text-navy-700 hover:underline">Kembali ke login</Link>
    </Shell>
  );
}

export function Reset() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const toast = useToast();
  const [p, setP] = useState(''); const [c, setC] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return; if (p !== c) return setErr('Konfirmasi password tidak sama'); setBusy(true); setErr('');
    try { await api('/auth/reset', { body: { token: sp.get('token'), password: p } }); toast('Password berhasil diubah. Silakan login.'); nav('/admin/login'); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Shell title="Buat Password Baru">
      <form onSubmit={go} className="space-y-4"><PasswordInput id="rp" label="Password baru (min. 8 karakter)" value={p} onChange={setP} /><PasswordInput id="rc" label="Konfirmasi password" value={c} onChange={setC} />
        {err && <p className="text-sm text-red-700">{err}</p>}<button className="btn-p w-full" disabled={busy}>Simpan password</button></form>
    </Shell>
  );
}

export function ChangePassword({ onDone, path = '/admin/change-password', askEmail = false }: { onDone: () => void; path?: string; askEmail?: boolean }) {
  const toast = useToast(); const [o, setO] = useState(''); const [p, setP] = useState(''); const [c, setC] = useState(''); const [em, setEm] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return; if (p !== c) return setErr('Konfirmasi password tidak sama'); setBusy(true); setErr('');
    try { await api(path, { body: { old_password: o, new_password: p, ...(askEmail ? { email: em } : {}) } }); toast('Password diperbarui'); onDone(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Shell title="Ganti Password Awal">
      <p className="mb-4 rounded bg-amber-50 p-3 text-sm text-slate-700">Akun ini masih memakai password awal. Buat password baru sebelum melanjutkan.</p>
      <form onSubmit={go} className="space-y-4">{askEmail && <div><label className="lbl" htmlFor="cem">Email aktif Anda (untuk pemulihan password)</label><input id="cem" type="email" required className="inp" value={em} onChange={(e) => setEm(e.target.value)} /></div>}<PasswordInput id="co" label="Password saat ini" value={o} onChange={setO} /><PasswordInput id="cp" label="Password baru (min. 8 karakter)" value={p} onChange={setP} /><PasswordInput id="cc" label="Konfirmasi password baru" value={c} onChange={setC} />
        {err && <p className="text-sm text-red-700">{err}</p>}<button className="btn-p w-full" disabled={busy}>Simpan dan lanjutkan</button></form>
    </Shell>
  );
}
