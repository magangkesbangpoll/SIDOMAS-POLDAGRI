import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Download, ExternalLink, FileText, Link2, Lock, Mail, MapPin, MessageCircle, Search, ShieldCheck, Users } from 'lucide-react';
import { api } from '../api';
import { ADART, Badge, DOC_STATUS, DOC_TYPES, DOKUMENTASI, Empty, InstagramIcon, nf, rincian, ErrorBox, Modal, Pager, fmtDate, fmtSize, qs, useDebounced, useFetch } from '../ui';

export const useMeta = () => useFetch<any>('/public/meta');
const waNumber = (n: string) => n.replace(/\D/g, '').replace(/^0/, '62'); // 0812... -> 62812... untuk tautan wa.me

export function PublicLayout() {
  const { data: meta } = useMeta();
  const nav = 'rounded px-3 py-2 text-sm font-semibold text-navy-100 hover:bg-navy-700 hover:text-white';
  const act = ({ isActive }: any) => `${nav} ${isActive ? 'bg-navy-700 text-white' : ''}`;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-4 border-gold-500 bg-navy-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded bg-gold-500 text-navy-900"><Building2 size={22} /></span>
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

export function Home() {
  const { data: meta } = useMeta();
  return (
    <>
      <section className="bg-navy-800 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-5">
          <div className="md:col-span-3">
            <h1 className="font-serif text-3xl font-bold leading-tight md:text-4xl">Data organisasi kemasyarakatan, tertata dan mudah ditelusuri.</h1>
            <p className="mt-4 max-w-xl text-navy-100">Telusuri katalog ormas yang dikelola Bidang Poldagri. Dokumen pendukung dilindungi dan hanya dapat dibuka dengan username dan password harian dari admin.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link to="/katalog" className="btn-g">Buka Katalog Ormas</Link><Link to="/daftar" className="btn bg-white text-navy-900 hover:bg-slate-100">Daftar Ormas Baru</Link><Link to="/tentang" className="btn bg-navy-700 text-white hover:bg-navy-600">Cara mengakses dokumen</Link></div>
          </div>
          <div className="rounded-lg border border-navy-600 bg-navy-900 p-6 md:col-span-2">
            <p className="text-sm text-navy-100">Ormas tampil di katalog</p>
            <p className="font-serif text-5xl font-bold text-gold-400">{meta ? meta.total_public : '–'}</p>
            <p className="mt-3 text-sm text-navy-100">Jumlah ini bertambah otomatis saat admin menerbitkan ormas baru.</p>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-10 md:grid-cols-3">
        {[[Search, 'Cari ormas', 'Cari berdasarkan nama atau ID Ormas, lalu saring menurut kategori bidang.'], [Lock, 'Masukkan kredensial harian', 'Username dan password berganti setiap hari dan hanya berlaku untuk satu ormas. Hubungi admin untuk mendapatkannya.'], [FileText, 'Baca dokumen', 'PDF dapat dibaca langsung di browser tanpa harus diunduh.']].map(([I, t, d]: any) => (
          <div key={t} className="card p-5"><I className="text-navy-700" /><h3 className="mt-3 font-serif text-lg font-bold text-navy-900">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p></div>
        ))}
      </section>
    </>
  );
}

export function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-3xl font-bold text-navy-900">Tentang Sistem</h1>
      <p className="mt-4 text-slate-700">SIDOMAS membantu Bidang Poldagri mendigitalkan data organisasi kemasyarakatan: data dasar ormas, dokumen legalitas dalam format PDF, dan status kelengkapannya.</p>
      <h2 className="mt-8 font-serif text-xl font-bold text-navy-900">Cara mengakses dokumen</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-700">
        <li>Buka Katalog Ormas, lalu tekan "Lihat Data Ormas" pada ormas yang dicari.</li><li>Lihat logo, struktur pengurus, dan email ormas.</li>
        <li>Untuk membuka atau mengunduh PDF, masukkan username dan password harian yang diberikan admin.</li><li>Baca PDF langsung di browser, atau unduh bila diperlukan.</li>
      </ol>
      <div className="mt-8 flex gap-3 rounded-md border border-gold-400 bg-amber-50 p-4 text-sm text-slate-700"><ShieldCheck className="shrink-0 text-gold-600" />Sistem ini merupakan sistem administrasi dan dokumentasi internal.</div>
    </div>
  );
}

export function Catalog() {
  const [q, setQ] = useState(''); const [kat, setKat] = useState(''); const [st, setSt] = useState(''); const [sort, setSort] = useState('nama'); const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data: meta } = useMeta();
  const { data, loading, error, reload } = useFetch<any>(`/public/ormas?${qs({ q: dq, kategori_id: kat, status_dokumen: st, sort: sort.replace('-desc', ''), dir: sort.endsWith('desc') ? 'desc' : 'asc', page })}`);
  useEffect(() => setPage(1), [dq, kat, st, sort]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-serif text-3xl font-bold text-navy-900">Katalog Ormas</h1>
      <div className="card mt-5 grid gap-3 p-4 md:grid-cols-4">
        <div className="relative md:col-span-2"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input className="inp pl-9" placeholder="Cari nama ormas atau ID Ormas" aria-label="Cari ormas" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="inp" aria-label="Filter kategori" value={kat} onChange={(e) => setKat(e.target.value)}><option value="">Semua kategori</option>{meta?.categories.filter((c: any) => c.status_aktif).map((c: any) => <option key={c.id} value={c.id}>{c.nama_kategori}</option>)}</select>
        <select className="inp" aria-label="Filter status dokumen" value={st} onChange={(e) => setSt(e.target.value)}><option value="">Semua status dokumen</option>{DOC_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="inp md:col-span-1" aria-label="Urutkan" value={sort} onChange={(e) => setSort(e.target.value)}><option value="nama">Nama A–Z</option><option value="nama-desc">Nama Z–A</option><option value="kode">ID terkecil</option><option value="kode-desc">ID terbesar</option></select>
        <p className="self-center text-sm text-slate-600 md:col-span-3 md:text-right">{data ? `${data.total} ormas ditemukan` : ''}</p>
      </div>
      <div className="mt-5">
        {error ? <ErrorBox text={`Data gagal dimuat: ${error}`} retry={reload} /> : loading && !data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-48 animate-pulse bg-slate-100" />)}</div>
        ) : data?.items.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((o: any) => (
              <article key={o.id} className="card flex flex-col p-4">
                <div className="flex items-start gap-3">
                  {o.has_logo ? <img src={`/api/logo/${o.kode_ormas}?v=${encodeURIComponent(o.updated_at)}`} alt="" className="h-14 w-14 rounded border border-slate-200 object-cover" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded bg-navy-50 text-navy-700"><Building2 /></span>}
                  <div className="min-w-0"><h3 className="font-serif text-base font-bold leading-snug text-navy-900">{o.nama_ormas}</h3><p className="mt-0.5 text-xs text-slate-500">{o.kode_ormas}</p></div>
                </div>
                <dl className="mt-3 space-y-0.5 text-xs text-slate-600">{[['Ketua', o.nama_ketua], ['Sekretaris', o.sekretaris], ['Bendahara', o.bendahara], ['Anggota', o.anggota_total == null ? null : `${nf(o.anggota_total)} orang`]].map(([l, v]) => <div key={l} className="flex gap-2"><dt className="w-20 shrink-0 text-slate-500">{l}</dt><dd className="font-semibold">{v || '-'}</dd></div>)}</dl>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">{o.nama_kategori}</span><Badge s={o.status_dokumen} /></div>
                <Link to={`/ormas/${o.kode_ormas}`} className="btn-p mt-4">Lihat Data Ormas</Link>
              </article>
            ))}
          </div>
        ) : <Empty text="Tidak ada ormas yang cocok dengan pencarian Anda. Ubah kata kunci atau hapus filter." />}
      </div>
      {data && <Pager page={page} total={data.total} size={12} onPage={setPage} />}
    </div>
  );
}

const readAcc = (kode?: string) => {
  try { const a = JSON.parse(sessionStorage.getItem('acc_' + kode) || 'null'); return a && new Date(a.expires_at) > new Date() ? a : null; } catch { return null; }
};

function CredModal({ o, onOk, onClose }: { o: any; onOk: (a: any) => void; onClose: () => void }) {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [busy, setBusy] = useState(false); const [popup, setPopup] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true);
    try { const d = await api(`/public/ormas/${o.kode_ormas}/access`, { body: { username: u.trim(), password: p } }); sessionStorage.setItem('acc_' + o.kode_ormas, JSON.stringify(d)); onOk(d); }
    catch (err: any) { setPopup(err.status === 401 ? 'USERNAME/PASSWORD YANG ANDA MASUKKAN SALAH, SILAHKAN HUBUNGI ADMIN' : err.message); }
    finally { setBusy(false); }
  };
  if (popup) return <Modal title="Akses ditolak" onClose={() => setPopup('')}><p className="font-semibold text-red-700">{popup}</p><div className="mt-5 text-right"><button className="btn-p" onClick={() => setPopup('')}>OK</button></div></Modal>;
  return (
    <Modal title="Dokumen Terbatas" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">Dokumen ini bersifat terbatas. Masukkan username dan password harian dari admin.</p>
        <div><span className="lbl">ID Ormas</span><div className="rounded bg-slate-100 px-3 py-2 text-sm"><b>{o.kode_ormas}</b> · {o.nama_ormas}</div></div>
        <div><label className="lbl" htmlFor="u">Username</label><input id="u" className="inp" autoComplete="off" required value={u} onChange={(e) => setU(e.target.value)} /></div>
        <div><label className="lbl" htmlFor="p">Password harian</label><input id="p" type="password" className="inp" autoComplete="off" required value={p} onChange={(e) => setP(e.target.value)} /></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-o" onClick={onClose}>Batal</button><button className="btn-p" disabled={busy}>{busy ? 'Memeriksa…' : 'Akses Dokumen'}</button></div>
      </form>
    </Modal>
  );
}

const petaQuery = (a: string) => (/yogyakarta|jogja/i.test(a) ? a : `${a}, Yogyakarta`);

export function OrmasPublic() {
  const { kode } = useParams();
  const { data: o, loading, error, reload } = useFetch<any>(`/public/ormas/${kode}`);
  const [ask, setAsk] = useState<{ doc: any; dl: boolean } | null>(null); const [view, setView] = useState<any>(null); const [acc, setAcc] = useState<any>(() => readAcc(kode));
  const [habis, setHabis] = useState(false);
  const akhiri = () => { try { sessionStorage.removeItem('acc_' + kode); } catch {} setAcc(null); setView(null); setAsk(null); setHabis(true); };
  // Sesi berakhir saat waktunya habis
  useEffect(() => { if (!acc) return; const t = setTimeout(akhiri, Math.max(0, new Date(acc.expires_at).getTime() - Date.now())); return () => clearTimeout(t); }, [acc]);
  // Cek ke server tiap 3 detik: jika admin membuat ulang password harian, akses PDF langsung ditutup (tanpa menunggu muat ulang)
  useEffect(() => {
    if (!acc) return; let off = false;
    const cek = async () => { try { const r = await fetch(`/api/public/session?token=${encodeURIComponent(acc.token)}`, { cache: 'no-store' }); if (!off && r.status === 401) akhiri(); } catch { /* jaringan putus sesaat: abaikan */ } };
    cek(); const t = setInterval(cek, 3000); const v = () => document.visibilityState === 'visible' && cek(); document.addEventListener('visibilitychange', v);
    return () => { off = true; clearInterval(t); document.removeEventListener('visibilitychange', v); };
  }, [acc?.token]);
  const url = (d: any, a: any, dl = false) => `/api/public/files/${d.id}?token=${encodeURIComponent(a.token)}${dl ? '&dl=1' : ''}`;
  const run = (d: any, dl: boolean, a: any) => { if (dl) window.location.href = url(d, a, true); else setView(view?.id === d.id ? null : d); };
  const click = async (d: any, dl: boolean) => {
    const a = readAcc(kode);
    if (a) { // pastikan sesi masih sah sebelum membuka
      try { const r = await fetch(`/api/public/session?token=${encodeURIComponent(a.token)}`, { cache: 'no-store' }); if (r.status === 401) return akhiri(); } catch {}
      return run(d, dl, a);
    }
    setAcc(null); setAsk({ doc: d, dl });
  };
  const label = (j: string) => [...DOC_TYPES, DOKUMENTASI, ADART].find(([k]) => k === j)?.[1] || j;
  const byType = (j: string) => o?.docs.find((d: any) => d.jenis_dokumen === j);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/katalog" className="btn-o mb-4"><ArrowLeft size={16} /> Kembali ke Katalog</Link>
      {error ? <ErrorBox text={error} retry={reload} /> : loading || !o ? <div className="card h-48 animate-pulse bg-slate-100" /> : (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-center gap-5 p-5">
            {o.has_logo ? <img src={`/api/logo/${o.kode_ormas}?v=${encodeURIComponent(o.updated_at)}`} alt={`Logo ${o.nama_ormas}`} className="h-28 w-28 rounded-lg border border-slate-200 object-cover" /> : <span className="grid h-28 w-28 place-items-center rounded-lg bg-navy-50 text-navy-700"><Building2 size={40} /></span>}
            <div className="min-w-0 flex-1"><p className="text-sm text-slate-500">{o.kode_ormas}</p><h1 className="font-serif text-2xl font-bold text-navy-900">{o.nama_ormas}</h1><div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">{o.nama_kategori}</span><Badge s={o.status_dokumen} /></div></div>
          </div>
          <div className="card p-5"><h2 className="mb-3 font-serif text-lg font-bold text-navy-900">Struktur Pengurus</h2>
            <div className="grid gap-3 sm:grid-cols-4">{[['Ketua', o.nama_ketua], ['Sekretaris', o.sekretaris], ['Bendahara', o.bendahara]].map(([l, v]) => <div key={l} className="rounded-md bg-navy-50 p-3"><p className="text-xs text-slate-500">{l}</p><p className="font-semibold text-navy-900">{v || '-'}</p></div>)}
              <div className="rounded-md bg-gold-400/20 p-3"><p className="flex items-center gap-1 text-xs text-slate-600"><Users size={13} />Jumlah anggota</p><p className="font-semibold text-navy-900">{o.anggota_total == null ? '-' : `${nf(o.anggota_total)} orang`}</p></div></div>
            {o.anggota_total != null && rincian(o) && <p className="mt-3 text-sm text-slate-600">Dari total anggota: <b>{rincian(o)}</b></p>}</div>
          {(o.link_dokumentasi || o.link_instagram || o.link_youtube || o.link_tiktok) && <div className="card p-5"><h2 className="mb-2 font-serif text-lg font-bold text-navy-900">Dokumentasi dan Media Sosial</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              {o.link_dokumentasi && <a className="btn-o" target="_blank" rel="noopener noreferrer" href={o.link_dokumentasi}><Link2 size={16} /> Dokumentasi kegiatan</a>}
              {o.link_instagram && <a className="btn-o" target="_blank" rel="noopener noreferrer" href={o.link_instagram}><InstagramIcon size={16} className="text-pink-600" /> Instagram ormas</a>}
              {o.link_youtube && <a className="btn-o" target="_blank" rel="noopener noreferrer" href={o.link_youtube}><ExternalLink size={16} className="text-red-600" /> YouTube</a>}
              {o.link_tiktok && <a className="btn-o" target="_blank" rel="noopener noreferrer" href={o.link_tiktok}><ExternalLink size={16} /> TikTok</a>}
            </div></div>}
          {o.company_profile && <div className="card p-5"><h2 className="mb-2 font-serif text-lg font-bold text-navy-900">Profil Ormas (Company Profile)</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm"><FileText className="text-red-600" /><span>{o.company_profile.nama_file} · {fmtSize(o.company_profile.ukuran_file)}</span>
              <a className="btn-p" target="_blank" rel="noopener noreferrer" href={`/api/public/ormas/${o.kode_ormas}/company-profile`}><ExternalLink size={15} /> Lihat</a>
              <a className="btn-o" href={`/api/public/ormas/${o.kode_ormas}/company-profile?dl=1`}><Download size={15} /> Unduh</a></div>
            <p className="mt-1 text-xs text-slate-500">Terbuka untuk umum, tanpa username dan password. File PPT/PPTX akan terunduh.</p></div>}
          <div className="card p-5"><h2 className="mb-2 font-serif text-lg font-bold text-navy-900">Kontak</h2>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <p className="flex min-w-0 items-center gap-2"><Mail size={16} className="shrink-0 text-navy-700" />{o.email_ormas ? <a className="min-w-0 text-navy-700 underline [overflow-wrap:anywhere]" href={`mailto:${o.email_ormas}`}>{o.email_ormas}</a> : <span className="text-slate-500">Email belum diisi</span>}</p>
              <p className="flex items-center gap-2"><MessageCircle size={16} className="shrink-0 text-navy-700" />{o.nomor_whatsapp_ketua ? <><a className="text-navy-700 underline" target="_blank" rel="noreferrer" href={`https://wa.me/${waNumber(o.nomor_whatsapp_ketua)}`}>{o.nomor_whatsapp_ketua}</a><span className="text-xs text-slate-500">(WhatsApp ketua)</span></> : <span className="text-slate-500">Nomor WhatsApp belum diisi</span>}</p>
            </div></div>
          {o.alamat && <div className="card p-5"><h2 className="mb-2 font-serif text-lg font-bold text-navy-900">Lokasi Kantor</h2>
            <p className="flex items-start gap-2 text-sm"><MapPin size={16} className="mt-0.5 shrink-0 text-navy-700" />{o.alamat}</p>
            <iframe title={`Peta lokasi ${o.nama_ormas}`} src={`https://www.google.com/maps?q=${encodeURIComponent(petaQuery(o.alamat))}&output=embed`} className="mt-3 h-64 w-full rounded-md border border-slate-200" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            <a className="mt-2 inline-flex items-center gap-1 text-sm text-navy-700 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(petaQuery(o.alamat))}`}><ExternalLink size={14} /> Buka di Google Maps</a>
            <p className="mt-1 text-xs text-slate-500">Letak pada peta dicari dari teks alamat, sehingga bisa kurang tepat.</p></div>}
          <div className="card divide-y divide-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2 p-4"><h2 className="font-serif text-lg font-bold text-navy-900">Dokumen</h2><p className="flex items-center gap-1 text-xs text-slate-500"><Lock size={13} /> {acc ? `Akses terbuka hingga ${fmtDate(acc.expires_at)}` : 'Terbatas: perlu username dan password dari admin'}</p></div>
            {[...DOC_TYPES, DOKUMENTASI, ADART].filter(([j]) => !['dokumentasi', 'adart'].includes(j) || byType(j)).map(([j, l]) => { const d = byType(j); return (
              <div key={j} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3"><FileText className={d ? 'text-red-600' : 'text-slate-300'} /><div><p className="text-sm font-semibold">{l}</p><p className="text-xs text-slate-500">{d ? `PDF · ${fmtSize(d.ukuran_file)}` : 'Belum diunggah'}</p></div></div>
                {d && <div className="flex gap-2"><button className="btn-p" onClick={() => click(d, false)}>{acc ? <ExternalLink size={15} /> : <Lock size={15} />} {view?.id === d.id ? 'Tutup PDF' : 'Buka PDF'}</button><button className="btn-o" onClick={() => click(d, true)}>{acc ? <Download size={15} /> : <Lock size={15} />} Download PDF</button></div>}
              </div>); })}
          </div>
          {view && acc && <div><p className="mb-2 text-sm font-semibold">{label(view.jenis_dokumen)}</p><iframe title={label(view.jenis_dokumen)} src={url(view, acc)} className="h-[75vh] w-full rounded-lg border border-slate-300 bg-white" /></div>}
        </div>)}
      {habis && <Modal title="Sesi Berakhir" onClose={() => setHabis(false)}><p className="font-semibold text-red-700">Sesi Anda Telah Habis, Silahkan Minta Username dan Password Lagi Kepada Admin!</p><div className="mt-5 text-right"><button className="btn-p" onClick={() => setHabis(false)}>OK</button></div></Modal>}
      {ask && o && <CredModal o={o} onClose={() => setAsk(null)} onOk={(a) => { setAcc(a); const t = ask; setAsk(null); run(t.doc, t.dl, a); }} />}
    </div>
  );
}
