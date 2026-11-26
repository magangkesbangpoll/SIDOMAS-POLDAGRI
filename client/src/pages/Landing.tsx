import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, FileText, Lock, Menu, Search, X } from 'lucide-react';
import { CountUp, Reveal } from '../fx';
import { useMeta } from './Public';

const LINKS: [string, string][] = [['/', 'Beranda'], ['/katalog', 'Katalog Ormas'], ['/daftar', 'Daftar Ormas Baru'], ['/tentang', 'Tentang Sistem'], ['/ormas-login', 'Login Ormas']];

export function PublicLayout() {
  const { data: meta } = useMeta(); const { pathname } = useLocation(); const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  const links = LINKS.map(([to, l]) => <NavLink key={to} to={to} end={to === '/'} className="pub-link">{l}</NavLink>);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 px-3 pt-3">
        <div className="topbar mx-auto max-w-6xl rounded-2xl px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="flex min-w-0 items-center gap-3">
              <span className="brand-mark h-10 w-10"><Building2 size={20} /></span>
              <span className="min-w-0"><span className="block text-[15px] font-extrabold leading-tight tracking-[.08em] text-ink">{meta?.app_name || 'SIDOMAS'}</span><span className="hidden truncate text-[11px] text-muted sm:block lg:hidden xl:block">Sistem Digitalisasi Data Organisasi Kemasyarakatan</span></span>
            </Link>
            <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Navigasi utama">{links}<Link to="/admin/login" className="btn-p ml-2">Login Admin</Link></nav>
            <button type="button" className="icon-btn lg:!hidden" aria-label={open ? 'Tutup menu' : 'Buka menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={18} /> : <Menu size={18} />}</button>
          </div>
          {open && <nav className="anim-fade-up mt-2 flex flex-col border-t border-line pt-2 lg:hidden" aria-label="Navigasi utama">{links}<Link to="/admin/login" className="btn-p mt-2">Login Admin</Link></nav>}
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="cinema mt-10 px-4 py-10 text-center text-xs text-slate-300">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
        <p className="text-sm font-extrabold tracking-[.22em] text-gold-soft">{meta?.app_name || 'SIDOMAS'}</p>
        <p className="mt-3">{meta?.app_name || 'SIDOMAS'} adalah sistem administrasi dan dokumentasi internal dengan katalog publik.</p>
        <p className="mt-1">Dibuat Oleh Muhammad Hilmi Zaidan Rafi - Universitas AMIKOM Yogyakarta.</p>
      </footer>
    </div>
  );
}

const STEPS: any[] = [
  [Search, 'Cari ormas', 'Cari berdasarkan nama atau ID Ormas, lalu saring menurut kategori bidang.'],
  [Lock, 'Masukkan kredensial harian', 'Username dan password berganti setiap hari dan hanya berlaku untuk satu ormas. Hubungi admin untuk mendapatkannya.'],
  [FileText, 'Baca dokumen', 'PDF dapat dibaca langsung di browser tanpa harus diunduh.'],
];

export function Home() {
  const { data: meta } = useMeta(); const nav = useNavigate(); const [q, setQ] = useState('');
  const cats = (meta?.categories || []).filter((c: any) => c.status_aktif);
  const cari = (e: React.FormEvent) => { e.preventDefault(); nav(q.trim() ? `/katalog?q=${encodeURIComponent(q.trim())}` : '/katalog'); };
  return (
    <>
      <section className="px-3 pt-3">
        <div className="cinema mx-auto max-w-6xl rounded-[28px] shadow-2xl shadow-navy/20">
          <div className="photo -z-20" style={{ backgroundImage: "url('/bg-tugu.jpg')", backgroundPosition: '48% 60%' }} aria-hidden="true" />
          <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ background: 'linear-gradient(96deg, rgb(11 17 32 / .95) 0%, rgb(11 17 32 / .82) 45%, rgb(11 17 32 / .3) 80%, rgb(11 17 32 / .45) 100%)' }} />
          <div className="px-5 pb-8 pt-14 sm:px-10 md:pb-12 md:pt-20">
            <p className="anim-fade-up text-[11px] font-bold uppercase tracking-[.22em] text-gold-soft">Portal Informasi · Bidang Poldagri</p>
            <h1 className="display anim-fade-up anim-d1 mt-4 max-w-3xl text-[2.35rem] text-white md:text-[3.5rem]">Mengenal dan Terhubung dengan Organisasi Kemasyarakatan Kota Yogyakarta</h1>
            <p className="anim-fade-up anim-d2 mt-5 max-w-xl text-base leading-relaxed text-slate-200 md:text-lg">Jelajahi informasi organisasi kemasyarakatan dalam satu portal informasi yang terintegrasi.</p>
            <form onSubmit={cari} role="search" className="anim-fade-up anim-d3 mt-8 flex max-w-xl flex-col gap-2 rounded-2xl border border-white/20 bg-white/10 p-2 backdrop-blur-xl sm:flex-row">
              <label className="relative flex-1"><span className="sr-only">Cari ormas</span><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input className="w-full rounded-xl bg-transparent py-2.5 pl-10 pr-3 text-base text-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-gold/60" placeholder="Cari nama ormas atau ID Ormas" value={q} onChange={(e) => setQ(e.target.value)} /></label>
              <button className="btn-g">Cari di Katalog <ArrowRight size={16} /></button>
            </form>
            <div className="anim-fade-up anim-d3 mt-4 flex flex-wrap gap-2">
              <Link to="/daftar" className="btn-glass">Daftar Ormas Baru</Link>
              <Link to="/tentang" className="btn-glass">Cara mengakses dokumen</Link>
            </div>
            <dl className="mt-12 flex flex-wrap gap-x-12 gap-y-5 border-t border-white/15 pt-6">
              <div><dt className="text-xs text-slate-300">Ormas tampil di katalog</dt><dd className="mt-1 text-4xl font-extrabold text-gold-soft"><CountUp value={meta ? meta.total_public : null} /></dd></div>
              <div><dt className="text-xs text-slate-300">Kategori bidang aktif</dt><dd className="mt-1 text-4xl font-extrabold text-white"><CountUp value={meta ? cats.length : null} /></dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal className="max-w-xl"><p className="eyebrow">Akses dokumen</p><h2 className="display mt-3 text-3xl md:text-4xl">Tiga langkah mengakses dokumen</h2><p className="mt-3 text-muted">Katalog terbuka untuk umum. Dokumen terbatas dibuka dengan kredensial harian dari admin.</p></Reveal>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map(([I, t, d], i) => (
            <li key={t}><Reveal delay={i * 0.08} className="h-full">
              <div className="card card-lift h-full p-6">
                <div className="flex items-center justify-between"><span className="font-serif text-4xl text-gold">0{i + 1}</span><I size={21} strokeWidth={1.6} className="text-muted" /></div>
                <h3 className="mt-8 text-base font-bold">{t}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
              </div>
            </Reveal></li>
          ))}
        </ol>
      </section>

      <section className="px-3">
        <Reveal className="mx-auto max-w-6xl">
          <div className="cinema grid items-center gap-6 rounded-[28px] p-7 sm:p-12 md:grid-cols-[1fr_auto]">
            <div className="photo -z-20" style={{ backgroundImage: "url('/bg-malioboro.jpg')" }} aria-hidden="true" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-night/95 via-navy-night/85 to-navy-night/55" aria-hidden="true" />
            <div><h2 className="display text-3xl text-white">Ormas Anda belum ada di katalog?</h2><p className="mt-3 max-w-xl text-slate-200">Ajukan pendaftaran lewat formulir online. Admin akan memverifikasi data Anda sebelum ormas tampil di katalog.</p></div>
            <Link to="/daftar" className="btn-g">Daftar Ormas Baru <ArrowRight size={16} /></Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
