import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { ArrowRight, Building2, FileText, Lock, Search, ShieldCheck } from 'lucide-react';
import { CountUp, Reveal } from '../fx';
import { useMeta } from './Public';

export function PublicLayout() {
  const { data: meta } = useMeta();
  const nav = 'rounded-md px-3 py-2 text-sm font-semibold text-navy-100 transition-all duration-200 hover:bg-white/10 hover:text-white';
  const act = ({ isActive }: any) => `${nav} ${isActive ? 'bg-white/15 text-white' : ''}`;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-4 border-gold-500 bg-navy-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="group flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-gold-500 text-navy-900 shadow-lg transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105"><Building2 size={22} /></span>
            <span><span className="block font-serif text-xl font-bold leading-tight">{meta?.app_name || 'SIDOMAS'}</span><span className="block text-xs text-navy-100">Sistem Digitalisasi Data Organisasi Kemasyarakatan</span></span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/" end className={act}>Beranda</NavLink>
            <NavLink to="/katalog" className={act}>Katalog Ormas</NavLink>
            <NavLink to="/daftar" className={act}>Daftar Ormas Baru</NavLink>
            <NavLink to="/tentang" className={act}>Tentang Sistem</NavLink>
            <NavLink to="/ormas-login" className={act}>Login Ormas</NavLink>
            <Link to="/admin/login" className="btn-g ml-1">Login Admin</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="bg-navy-900 py-5 text-center text-xs text-navy-100">
        <p>{meta?.app_name || 'SIDOMAS'} adalah sistem administrasi dan dokumentasi internal dengan katalog publik.</p>
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
  const { data: meta } = useMeta();
  return (
    <>
      <section className="photo-blend text-white">
        <div aria-hidden="true" className="anim-drift pointer-events-none absolute -left-24 top-6 h-72 w-72 rounded-full bg-gold-500/20 blur-3xl" />
        <div aria-hidden="true" className="anim-drift pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-navy-600/40 blur-3xl" style={{ animationDelay: '-6s' }} />
        <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 pb-24 pt-16 md:grid-cols-5 md:pt-24">
          <div className="md:col-span-3">
            <span className="anim-fade-up inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-white/10 px-3 py-1 text-xs font-semibold text-gold-400 backdrop-blur"><ShieldCheck size={14} /> Bidang Poldagri</span>
            <h1 className="anim-fade-up anim-d1 mt-4 font-serif text-4xl font-bold leading-tight md:text-5xl">Data organisasi kemasyarakatan, <span className="shimmer-text">tertata</span> dan mudah ditelusuri.</h1>
            <p className="anim-fade-up anim-d2 mt-5 max-w-xl text-lg text-navy-100">Telusuri katalog ormas yang dikelola Bidang Poldagri. Dokumen pendukung dilindungi dan hanya dapat dibuka dengan username dan password harian dari admin.</p>
            <div className="anim-fade-up anim-d3 mt-8 flex flex-wrap gap-3">
              <Link to="/katalog" className="btn-g">Buka Katalog Ormas <ArrowRight size={16} /></Link>
              <Link to="/daftar" className="btn bg-white text-navy-900 hover:bg-slate-100">Daftar Ormas Baru</Link>
              <Link to="/tentang" className="btn border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20">Cara mengakses dokumen</Link>
            </div>
          </div>
          <div className="anim-fade-up anim-d3 md:col-span-2">
            <div className="anim-float rounded-2xl border border-white/20 bg-white/10 p-7 shadow-2xl backdrop-blur-md">
              <p className="text-sm text-navy-100">Ormas tampil di katalog</p>
              <p className="font-serif text-6xl font-bold text-gold-400"><CountUp value={meta ? meta.total_public : null} /></p>
              <p className="mt-3 text-sm text-navy-100">Jumlah ini bertambah otomatis saat admin menerbitkan ormas baru.</p>
            </div>
          </div>
        </div>
        <svg aria-hidden="true" className="absolute inset-x-0 bottom-0 z-10 block h-10 w-full fill-slate-50 md:h-14" viewBox="0 0 1440 60" preserveAspectRatio="none"><path d="M0,36 C240,70 480,4 720,30 C960,56 1200,12 1440,38 L1440,60 L0,60 Z" /></svg>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <Reveal>
          <h2 className="text-center font-serif text-2xl font-bold text-navy-900 md:text-3xl">Tiga langkah mengakses dokumen</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-slate-600">Katalog terbuka untuk umum. Dokumen terbatas dibuka dengan kredensial harian dari admin.</p>
        </Reveal>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {STEPS.map(([I, t, d], i) => (
            <Reveal key={t} delay={i * 0.12} className="h-full">
              <div className="card group relative h-full overflow-hidden p-6 transition duration-300 hover:-translate-y-1.5 hover:border-gold-400 hover:shadow-xl">
                <span className="absolute right-4 top-3 font-serif text-5xl font-bold text-navy-100/70">0{i + 1}</span>
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-navy-700 to-navy-900 text-gold-400 shadow-md transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"><I size={22} /></span>
                <h3 className="mt-4 font-serif text-lg font-bold text-navy-900">{t}</h3>
                <p className="mt-1 text-sm text-slate-600">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="photo-blend text-white">
        <Reveal className="relative z-10 mx-auto max-w-4xl px-4 py-14 text-center">
          <h2 className="font-serif text-2xl font-bold md:text-3xl">Ormas Anda belum ada di katalog?</h2>
          <p className="mx-auto mt-3 max-w-xl text-navy-100">Ajukan pendaftaran lewat formulir online. Admin akan memverifikasi data Anda sebelum ormas tampil di katalog.</p>
          <Link to="/daftar" className="btn-g mt-6">Daftar Ormas Baru <ArrowRight size={16} /></Link>
        </Reveal>
      </section>
    </>
  );
}
