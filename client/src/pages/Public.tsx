import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, Download, ExternalLink, FileText, Link2, Lock, Mail, MapPin, MessageCircle, Search, ShieldCheck, Users } from 'lucide-react';
import { api } from '../api';
import { ADART, Badge, CompanyProfileGuide, CpStatus, DOC_STATUS, DOC_TYPES, DOKUMENTASI, Empty, InstagramIcon, nf, rincian, ErrorBox, Modal, Pager, fmtDate, fmtSize, qs, useDebounced, useFetch } from '../ui';

export const useMeta = () => useFetch<any>('/public/meta');
const waNumber = (n: string) => n.replace(/\D/g, '').replace(/^0/, '62'); // 0812... -> 62812... untuk tautan wa.me

export function About() {
  return (
    <div className="stagger mx-auto max-w-3xl px-4 py-12">
      <div><p className="eyebrow">Tentang</p><h1 className="display mt-3 text-4xl text-ink">Tentang Sistem</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">SIDOMAS membantu Bidang Poldagri mendigitalkan data organisasi kemasyarakatan: data dasar ormas, dokumen legalitas dalam format PDF, dan status kelengkapannya.</p></div>
      <section className="card mt-9 p-6 sm:p-8"><h2 className="display text-2xl">Cara mengakses dokumen</h2>
        <ol className="mt-6 space-y-5">{['Buka Katalog Ormas, lalu tekan "Lihat Data Ormas" pada ormas yang dicari.', 'Lihat logo, struktur pengurus, dan email ormas.', 'Untuk membuka atau mengunduh PDF, masukkan username dan password harian yang diberikan admin.', 'Baca PDF langsung di browser, atau unduh bila diperlukan.'].map((t, i) => (
          <li key={t} className="flex gap-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gold/60 font-serif text-sm text-ink">{i + 1}</span><p className="pt-1">{t}</p></li>))}</ol></section>
      <div className="note-warn mt-5 flex gap-3 !p-4"><ShieldCheck className="shrink-0 text-gold" />Sistem ini merupakan sistem administrasi dan dokumentasi internal.</div>
    </div>
  );
}

export function Catalog() {
  const [sp] = useSearchParams();
  const [q, setQ] = useState(() => sp.get('q') || ''); const [kat, setKat] = useState(''); const [st, setSt] = useState(''); const [sort, setSort] = useState('nama'); const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data: meta } = useMeta();
  const { data, loading, error, reload } = useFetch<any>(`/public/ormas?${qs({ q: dq, kategori_id: kat, status_dokumen: st, sort: sort.replace('-desc', ''), dir: sort.endsWith('desc') ? 'desc' : 'asc', page })}`);
  useEffect(() => setPage(1), [dq, kat, st, sort]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="eyebrow">Direktori publik</p>
      <h1 className="display mt-3 text-4xl text-ink md:text-5xl">Katalog Ormas</h1>
      <div className="card mt-7 grid gap-3 p-4 md:grid-cols-4">
        <div className="relative md:col-span-2"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="inp pl-9" placeholder="Cari nama ormas atau ID Ormas" aria-label="Cari ormas" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="inp" aria-label="Filter kategori" value={kat} onChange={(e) => setKat(e.target.value)}><option value="">Semua kategori</option>{meta?.categories.filter((c: any) => c.status_aktif).map((c: any) => <option key={c.id} value={c.id}>{c.nama_kategori}</option>)}</select>
        <select className="inp" aria-label="Filter status dokumen" value={st} onChange={(e) => setSt(e.target.value)}><option value="">Semua status dokumen</option>{DOC_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="inp md:col-span-1" aria-label="Urutkan" value={sort} onChange={(e) => setSort(e.target.value)}><option value="nama">Nama A–Z</option><option value="nama-desc">Nama Z–A</option><option value="kode">ID terkecil</option><option value="kode-desc">ID terbesar</option></select>
        <p className="self-center text-sm text-muted md:col-span-3 md:text-right" aria-live="polite">{data ? `${data.total} ormas ditemukan` : ''}</p>
      </div>
      <div className="mt-6">
        {error ? <ErrorBox text={`Data gagal dimuat: ${error}`} retry={reload} /> : loading && !data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skel h-64 !rounded-2xl" />)}</div>
        ) : data?.items.length ? (
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((o: any) => (
              <article key={o.id} className="card-solid card-lift group relative flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  {o.has_logo ? <img src={`/api/logo/${o.kode_ormas}?v=${encodeURIComponent(o.updated_at)}`} alt="" className="h-14 w-14 shrink-0 rounded-2xl border border-line object-cover" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-navy text-gold-soft"><Building2 strokeWidth={1.6} /></span>}
                  <span className="mono text-xs text-muted">{o.kode_ormas}</span>
                </div>
                <p className="eyebrow mt-5">{o.nama_kategori}</p>
                <h2 className="mt-1.5 font-serif text-xl font-medium leading-snug">{o.nama_ormas}</h2>
                <div className="mt-3"><Badge s={o.status_dokumen} /></div>
                <dl className="mb-4 mt-4 space-y-1 border-t border-line pt-4 text-xs">{[['Ketua', o.nama_ketua], ['Sekretaris', o.sekretaris], ['Bendahara', o.bendahara], ['Anggota', o.anggota_total == null ? null : `${nf(o.anggota_total)} orang`]].map(([l, v]) => <div key={l} className="flex gap-2"><dt className="w-20 shrink-0 text-muted">{l}</dt><dd className="min-w-0 font-semibold text-ink">{v || '-'}</dd></div>)}</dl>
                <Link to={`/ormas/${o.kode_ormas}`} className="txt-link mt-auto inline-flex items-center gap-1.5 text-sm after:absolute after:inset-0 after:rounded-2xl">Lihat Data Ormas <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></Link>
              </article>
            ))}
          </div>
        ) : <div className="card"><Empty text="Tidak ada ormas yang cocok dengan pencarian Anda. Ubah kata kunci atau hapus filter." /></div>}
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
  if (popup) return <Modal title="Akses ditolak" onClose={() => setPopup('')}><p className="note-bad font-semibold !text-bad">{popup}</p><div className="mt-5 text-right"><button className="btn-p" onClick={() => setPopup('')}>OK</button></div></Modal>;
  return (
    <Modal title="Dokumen Terbatas" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">Dokumen ini bersifat terbatas. Masukkan username dan password harian dari admin.</p>
        <div><span className="lbl">ID Ormas</span><div className="readonly"><b>{o.kode_ormas}</b> · {o.nama_ormas}</div></div>
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
      {error ? <ErrorBox text={error} retry={reload} /> : loading || !o ? <div className="skel h-48 !rounded-2xl" /> : (
        <div className="stagger space-y-4">
          <div className="card relative flex flex-wrap items-center gap-6 overflow-hidden !rounded-3xl p-6 sm:p-8"><span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-navy via-gold to-transparent" />
            {o.has_logo ? <img src={`/api/logo/${o.kode_ormas}?v=${encodeURIComponent(o.updated_at)}`} alt={`Logo ${o.nama_ormas}`} className="h-28 w-28 rounded-2xl border border-line object-cover" /> : <span className="grid h-28 w-28 place-items-center rounded-2xl bg-navy text-gold-soft"><Building2 size={40} /></span>}
            <div className="min-w-0 flex-1"><p className="eyebrow">{o.kode_ormas}</p><h1 className="display mt-2 text-3xl text-ink md:text-4xl">{o.nama_ormas}</h1><div className="mt-3 flex flex-wrap items-center gap-2"><span className="chip-n">{o.nama_kategori}</span><Badge s={o.status_dokumen} /></div></div>
          </div>
          <div className="card p-5 sm:p-6"><h2 className="mb-3 text-lg font-bold text-ink">Struktur Pengurus</h2>
            <div className="grid gap-3 sm:grid-cols-4">{[['Ketua', o.nama_ketua], ['Sekretaris', o.sekretaris], ['Bendahara', o.bendahara]].map(([l, v]) => <div key={l} className="panel"><p className="text-xs text-muted">{l}</p><p className="font-semibold text-ink">{v || '-'}</p></div>)}
              <div className="panel !border-gold/40 !bg-gold/10"><p className="flex items-center gap-1 text-xs text-muted"><Users size={13} />Jumlah anggota</p><p className="font-semibold text-ink">{o.anggota_total == null ? '-' : `${nf(o.anggota_total)} orang`}</p></div></div>
            {o.anggota_total != null && rincian(o) && <p className="mt-3 text-sm text-muted">Dari total anggota: <b>{rincian(o)}</b></p>}</div>
          {(o.link_dokumentasi || o.link_instagram || o.link_youtube || o.link_tiktok) && <div className="card p-5 sm:p-6"><h2 className="mb-2 text-lg font-bold text-ink">Dokumentasi dan Media Sosial</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              {o.link_dokumentasi && <a className="btn-o" target="_blank" rel="noopener noreferrer" href={o.link_dokumentasi}><Link2 size={16} /> Dokumentasi kegiatan</a>}
              {o.link_instagram && <a className="btn-o" target="_blank" rel="noopener noreferrer" href={o.link_instagram}><InstagramIcon size={16} className="text-bad" /> Instagram ormas</a>}
              {o.link_youtube && <a className="btn-o" target="_blank" rel="noopener noreferrer" href={o.link_youtube}><ExternalLink size={16} className="text-bad" /> YouTube</a>}
              {o.link_tiktok && <a className="btn-o" target="_blank" rel="noopener noreferrer" href={o.link_tiktok}><ExternalLink size={16} /> TikTok</a>}
            </div></div>}
          {o.company_profile && <div className="card p-5 sm:p-6"><h2 className="mb-2 text-lg font-bold text-ink">Profil Ormas (Company Profile)</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm"><FileText className="text-bad" /><span>{o.company_profile.nama_file} · {fmtSize(o.company_profile.ukuran_file)}</span>
              <a className="btn-p" target="_blank" rel="noopener noreferrer" href={`/api/public/ormas/${o.kode_ormas}/company-profile`}><ExternalLink size={15} /> Lihat</a>
              <a className="btn-o" href={`/api/public/ormas/${o.kode_ormas}/company-profile?dl=1`}><Download size={15} /> Unduh</a></div>
            <div className="mt-2"><CpStatus cpBagian={o.cp_bagian} hasFile /></div>
            <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold text-link">Bagian yang wajib ada di Company Profile</summary><div className="mt-1 grid"><CompanyProfileGuide compact /></div></details>
            <p className="mt-1 text-xs text-muted">Terbuka untuk umum, tanpa username dan password. File PPT/PPTX akan terunduh.</p></div>}
          <div className="card p-5 sm:p-6"><h2 className="mb-2 text-lg font-bold text-ink">Kontak</h2>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <p className="flex min-w-0 items-center gap-2"><Mail size={16} className="shrink-0 text-link" />{o.email_ormas ? <a className="min-w-0 text-link underline [overflow-wrap:anywhere]" href={`mailto:${o.email_ormas}`}>{o.email_ormas}</a> : <span className="text-muted">Email belum diisi</span>}</p>
              <p className="flex items-center gap-2"><MessageCircle size={16} className="shrink-0 text-link" />{o.nomor_whatsapp_ketua ? <><a className="text-link underline" target="_blank" rel="noreferrer" href={`https://wa.me/${waNumber(o.nomor_whatsapp_ketua)}`}>{o.nomor_whatsapp_ketua}</a><span className="text-xs text-muted">(WhatsApp ketua)</span></> : <span className="text-muted">Nomor WhatsApp belum diisi</span>}</p>
            </div></div>
          {o.alamat && <div className="card p-5 sm:p-6"><h2 className="mb-2 text-lg font-bold text-ink">Lokasi Kantor</h2>
            <p className="flex items-start gap-2 text-sm"><MapPin size={16} className="mt-0.5 shrink-0 text-link" />{o.alamat}</p>
            <iframe title={`Peta lokasi ${o.nama_ormas}`} src={`https://www.google.com/maps?q=${encodeURIComponent(petaQuery(o.alamat))}&output=embed`} className="mt-3 h-64 w-full rounded-xl border border-line" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            <a className="mt-2 inline-flex items-center gap-1 text-sm text-link underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(petaQuery(o.alamat))}`}><ExternalLink size={14} /> Buka di Google Maps</a>
            <p className="mt-1 text-xs text-muted">Letak pada peta dicari dari teks alamat, sehingga bisa kurang tepat.</p></div>}
          <div className="card-solid divide-y divide-line">
            <div className="flex flex-wrap items-center justify-between gap-2 p-4"><h2 className="text-lg font-bold text-ink">Dokumen</h2><p className="flex items-center gap-1 text-xs text-muted"><Lock size={13} /> {acc ? `Akses terbuka hingga ${fmtDate(acc.expires_at)}` : 'Terbatas: perlu username dan password dari admin'}</p></div>
            {[...DOC_TYPES, DOKUMENTASI, ADART].filter(([j]) => !['dokumentasi', 'adart'].includes(j) || byType(j)).map(([j, l]) => { const d = byType(j); return (
              <div key={j} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3"><FileText className={d ? 'text-bad' : 'text-muted/40'} /><div><p className="text-sm font-semibold">{l}</p><p className="text-xs text-muted">{d ? `PDF · ${fmtSize(d.ukuran_file)}` : 'Belum diunggah'}</p></div></div>
                {d && <div className="flex gap-2"><button className="btn-p" onClick={() => click(d, false)}>{acc ? <ExternalLink size={15} /> : <Lock size={15} />} {view?.id === d.id ? 'Tutup PDF' : 'Buka PDF'}</button><button className="btn-o" onClick={() => click(d, true)}>{acc ? <Download size={15} /> : <Lock size={15} />} Download PDF</button></div>}
              </div>); })}
          </div>
          {view && acc && <div><p className="mb-2 text-sm font-semibold">{label(view.jenis_dokumen)}</p><iframe title={label(view.jenis_dokumen)} src={url(view, acc)} className="h-[75vh] w-full rounded-2xl border border-line bg-white" /></div>}
        </div>)}
      {habis && <Modal title="Sesi Berakhir" onClose={() => setHabis(false)}><p className="note-bad font-semibold !text-bad">Sesi Anda Telah Habis, Silahkan Minta Username dan Password Lagi Kepada Admin!</p><div className="mt-5 text-right"><button className="btn-p" onClick={() => setHabis(false)}>OK</button></div></Modal>}
      {ask && o && <CredModal o={o} onClose={() => setAsk(null)} onOk={(a) => { setAcc(a); const t = ask; setAsk(null); run(t.doc, t.dl, a); }} />}
    </div>
  );
}
