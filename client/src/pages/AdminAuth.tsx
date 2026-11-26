import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, Eye, EyeOff } from 'lucide-react';
import { api } from '../api';
import { Spinner, useToast } from '../ui';

export const Shell = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div data-theme="dark" className="cinema flex min-h-screen items-center justify-center p-4 sm:p-8">
    <div className="photo kenburns -z-20" style={{ backgroundImage: "url('/bg-tugu.jpg')" }} aria-hidden="true" />
    <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ background: 'linear-gradient(105deg, rgb(11 17 32 / .94) 0%, rgb(11 17 32 / .74) 48%, rgb(17 27 45 / .5) 100%), radial-gradient(50% 55% at 80% 18%, rgb(198 169 107 / .22), transparent 70%)' }} />
    <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
      <div className="anim-fade-up hidden lg:block">
        <p className="eyebrow">Sistem Digitalisasi Organisasi Kemasyarakatan</p>
        <p className="display mt-5 text-6xl text-white">SIDOMAS</p>
        <span className="mt-6 block h-px w-24 bg-gradient-to-r from-gold to-transparent" />
        <p className="mt-6 max-w-md text-lg leading-relaxed text-body">Digitalisasi data, transparansi informasi, dan penguatan organisasi kemasyarakatan.</p>
      </div>
      <div className="card anim-fade-up anim-d1 mx-auto w-full max-w-sm p-6 sm:p-7">
        <div className="mb-6 flex items-center gap-3"><span className="brand-mark h-11 w-11"><Building2 size={21} /></span><div><p className="text-xs font-bold uppercase tracking-[.2em] text-gold">SIDOMAS</p><h1 className="text-lg font-bold leading-tight">{title}</h1></div></div>
        {children}
        <Link to="/" className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted hover:text-ink"><ArrowLeft size={13} /> Kembali ke halaman publik</Link>
      </div>
    </div>
  </div>
);
export const PasswordInput = ({ id, value, onChange, label }: any) => {
  const [show, setShow] = useState(false);
  return (<div><label className="lbl" htmlFor={id}>{label}</label><div className="relative"><input id={id} type={show ? 'text' : 'password'} className="inp pr-10" required value={value} onChange={(e) => onChange(e.target.value)} /><button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted hover:text-ink" aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>);
};

export function Login() {
  const nav = useNavigate(); const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => { e.preventDefault(); if (busy) return; setBusy(true); setErr(''); try { await api('/auth/login', { body: { username: u.trim(), password: p } }); nav('/admin'); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  return (
    <Shell title="Login Admin">
      <form onSubmit={go} className="space-y-4">
        <div><label className="lbl" htmlFor="lu">Username</label><input id="lu" className="inp" autoComplete="username" required value={u} onChange={(e) => setU(e.target.value)} /></div>
        <PasswordInput id="lp" label="Password" value={p} onChange={setP} />
        {err && <p className="note-bad !text-bad" role="alert">{err}</p>}
        <button className="btn-p w-full" disabled={busy}>{busy ? <><Spinner /> Memeriksa…</> : 'Login'}</button>
        <Link to="/admin/forgot" className="txt-link block text-center text-sm">Lupa Password?</Link>
      </form>
    </Shell>
  );
}

export function Forgot() {
  const [email, setEmail] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const go = async (e: React.FormEvent) => { e.preventDefault(); if (busy) return; setBusy(true); setErr(''); try { await api('/auth/forgot', { body: { email } }); setDone(true); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  return (
    <Shell title="Pemulihan Password">
      {done ? <p className="text-sm text-body">Jika email terdaftar, tautan pemulihan sudah dikirim dan berlaku 30 menit. Periksa kotak masuk Anda.</p> : (
        <form onSubmit={go} className="space-y-4"><div><label className="lbl" htmlFor="fe">Email terdaftar</label><input id="fe" type="email" className="inp" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {err && <p className="note-bad !text-bad" role="alert">{err}</p>}<button className="btn-p w-full" disabled={busy}>Kirim tautan pemulihan</button></form>)}
      <Link to="/admin/login" className="txt-link mt-4 block text-center text-sm">Kembali ke login</Link>
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
        {err && <p className="note-bad !text-bad" role="alert">{err}</p>}<button className="btn-p w-full" disabled={busy}>Simpan password</button></form>
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
      <p className="note-warn mb-4">Akun ini masih memakai password awal. Buat password baru sebelum melanjutkan.</p>
      <form onSubmit={go} className="space-y-4">{askEmail && <div><label className="lbl" htmlFor="cem">Email aktif Anda (untuk pemulihan password)</label><input id="cem" type="email" required className="inp" value={em} onChange={(e) => setEm(e.target.value)} /></div>}<PasswordInput id="co" label="Password saat ini" value={o} onChange={setO} /><PasswordInput id="cp" label="Password baru (min. 8 karakter)" value={p} onChange={setP} /><PasswordInput id="cc" label="Konfirmasi password baru" value={c} onChange={setC} />
        {err && <p className="note-bad !text-bad" role="alert">{err}</p>}<button className="btn-p w-full" disabled={busy}>Simpan dan lanjutkan</button></form>
    </Shell>
  );
}
