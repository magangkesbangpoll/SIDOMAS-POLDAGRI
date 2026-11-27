import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Copy, Download, Send } from 'lucide-react';
import { api } from '../api';
import { ADART, COMPANY_PROFILE, CompanyProfileGuide, CpChecklist, DOC_TYPES, DOKUMENTASI, KEMANTREN, LegalStatusFields, LinkInputs, docAccept, docTypeOk, fmtSize, useFetch, useToast } from '../ui';

const BENTUK = ['YAYASAN', 'PERKUMPULAN', 'LEMBAGA', 'PAGUYUBAN', 'LAINNYA'];
const MEM: [string, string][] = [['anggota_total', 'Total anggota'], ['anggota_perempuan', 'Anggota perempuan'], ['anggota_lansia', 'Anggota lansia'], ['anggota_disabilitas', 'Anggota disabilitas']];
const KEYS = ['bidang_kegiatan', 'kemantren', 'nama_ketua', 'sekretaris', 'bendahara', 'nomor_whatsapp_ketua', 'telepon_ormas', 'email_ormas', 'alamat', 'legal_status', 'legal_jenis', 'nomor_sk', 'legal_tahun', 'legal_berlaku_sd', ...MEM.map(([k]) => k), 'link_dokumentasi', 'link_instagram', 'link_youtube', 'link_tiktok', 'cp_bagian'];
const Tag = ({ wajib }: { wajib: boolean }) => <span className={`chip ml-2 align-middle !text-[10px] uppercase ${wajib ? 'text-bad' : 'text-muted'}`}>{wajib ? 'Wajib diisi' : 'Opsional'}</span>;

// Pendaftaran ormas baru (publik). Label "Wajib diisi" atau "Opsional" ditampilkan di judul tiap kategori.
export function Daftar() {
  const toast = useToast(); const { data: meta } = useFetch<any>('/public/meta');
  const [kat, setKat] = useState(''); const [bp, setBp] = useState(''); const [bl, setBl] = useState('');
  const [f, setF] = useState<any>(Object.fromEntries(KEYS.map((k) => [k, ''])));
  const [logo, setLogo] = useState<File | null>(null); const [logoUrl, setLogoUrl] = useState(''); const [logoWarn, setLogoWarn] = useState<string[]>([]);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [hasil, setHasil] = useState<any>(null);
  const maxMb = meta?.max_pdf_mb || 20;
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const T = (k: string, label: string, o: any = {}) => <div className={o.span ? 'col-span-full' : ''}><label className="lbl" htmlFor={k}>{label}</label><input id={k} type={o.type || 'text'} className="inp" placeholder={o.ph} maxLength={o.max} required={o.req} value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} /></div>;
  const H = (t: string, wajib: boolean) => <h3 className="form-h">{t}<Tag wajib={wajib} /></h3>;
  const pick = (j: string, x?: File) => {
    if (!x) return; if (!docTypeOk(j, x)) return toast(`"${x.name}" format tidak didukung${j === 'company_profile' ? ' (PDF, PPT, atau PPTX)' : ' (harus PDF)'}`, false); if (x.size > maxMb * 1048576) return toast(`"${x.name}" melebihi ${maxMb} MB`, false);
    setFiles((p) => ({ ...p, [j]: x }));
  };
  const pickLogo = (x?: File) => {
    if (!x) return;
    if (!['image/png', 'image/jpeg'].includes(x.type) || !/\.(png|jpe?g)$/i.test(x.name)) return toast('Format logo harus PNG, JPG, atau JPEG', false);
    if (x.size > 1048576) return toast('Ukuran logo maksimal 1 MB', false);
    const rd = new FileReader();
    rd.onload = () => {
      const url = String(rd.result), im = new Image();
      im.onload = () => {
        const w: string[] = [], a = im.naturalWidth, b = im.naturalHeight;
        if (Math.abs(a - b) > Math.max(a, b) * 0.02) w.push(`Gambar tidak berbentuk persegi (${a}×${b} px). Gunakan rasio 1:1 agar logo tidak terpotong atau gepeng.`);
        else if (a < 512) w.push(`Resolusi ${a}×${b} px lebih kecil dari rekomendasi 512×512 px, logo bisa terlihat buram.`);
        if (x.size > 512000) w.push('Ukuran file lebih dari 500 KB. Ukuran ideal di bawah 500 KB.');
        setLogoWarn(w);
      };
      im.src = url; setLogoUrl(url);
    };
    rd.readAsDataURL(x); setLogo(x);
  };
  const FileBox = (j: string, l: string) => (
    <div key={j} className={`drop ${files[j] ? 'drop-on' : ''}`}>
      <label className="lbl" htmlFor={'f_' + j}>{l}</label>
      <input id={'f_' + j} type="file" accept={docAccept(j)} className="w-full text-xs" onChange={(e) => { pick(j, e.target.files?.[0]); e.target.value = ''; }} />
      {files[j] && <p className="mt-1 text-xs text-muted">{files[j].name} ({fmtSize(files[j].size)}) <button type="button" className="text-bad underline" onClick={() => setFiles((p) => { const n = { ...p }; delete n[j]; return n; })}>batal</button></p>}
    </div>
  );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    const bentuk = bp === 'LAINNYA' ? bl.trim() : bp;
    if (!bentuk) return toast('Bentuk ormas wajib diisi', false);
    if (!logo) return toast('Logo ormas wajib diunggah', false);
    if (!files.adart) return toast('Dokumen AD/ART wajib diunggah', false);
    if (!files.company_profile) return toast('Company Profile wajib diunggah', false);
    const tot = +f.anggota_total; if (['anggota_perempuan', 'anggota_lansia', 'anggota_disabilitas'].some((k) => +f[k] > tot)) return toast('Jumlah perempuan, lansia, dan disabilitas tidak boleh lebih besar dari total anggota', false);
    setBusy(true);
    const fd = new FormData(); fd.append('nama_ormas', String(f.nama_ormas ?? '').trim()); fd.append('kategori_nama', kat); fd.append('bentuk', bentuk);
    KEYS.forEach((k) => fd.append(k, String(f[k] ?? ''))); Object.entries(files).forEach(([j, x]) => fd.append(j, x)); fd.append('logo', logo);
    try { const r = await api<any>('/public/daftar', { method: 'POST', form: fd }); setHasil(r); setDone(true); window.scrollTo(0, 0); } catch (x: any) { toast(x.message, false); } finally { setBusy(false); }
  };
  const salin = async (v: string, label: string) => {
    try { await navigator.clipboard.writeText(v); toast(`${label} disalin`); }
    catch { toast('Gagal menyalin. Silakan pilih teksnya lalu salin manual.', false); }
  };
  const unduhInfo = () => {
    const isi = [
      'SIDOMAS — INFORMASI PENDAFTARAN ORMAS',
      '=====================================',
      `Nama Ormas   : ${f.nama_ormas}`,
      `Tracking ID  : ${hasil?.tracking_id || ''}`,
      `Email ormas  : ${String(f.email_ormas || '')}`,
      `Tanggal      : ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
      '',
      'Simpan Tracking ID ini. Saat ingin mengecek status, buka /tracking lalu pilih Kirim OTP lewat email atau WhatsApp.',
      `Email: ${String(f.email_ormas || '')} · WhatsApp: ${String(f.nomor_whatsapp_ketua || '')}`,
      'Kode OTP 6 digit berlaku 10 menit.',
    ].join('\n');
    const a = document.createElement('a');
    const u = URL.createObjectURL(new Blob([isi], { type: 'text/plain;charset=utf-8' }));
    a.href = u; a.download = `tracking-${String(hasil?.tracking_id || 'sidomas').replace(/[^A-Za-z0-9-]/g, '')}.txt`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
    toast('Informasi tracking diunduh');
  };
  if (done) return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="text-center"><CheckCircle2 className="mx-auto text-ok" size={48} />
        <h1 className="mt-3 page-title">Pendaftaran terkirim</h1>
        <p className="mt-2 text-muted">Data ormas Anda sudah masuk dan berstatus <b>Tindak Lanjuti</b>. Berkas masih disimpan sementara; setelah admin menyetujui, folder Google Drive atas nama ormas Anda dibuat dan berkas dipindahkan ke folder tersebut.</p>
      </div>
      <div className="pub-card-solid mt-6 space-y-3 p-5">
        <p className="eyebrow">Informasi penting — simpan sekarang</p>
        <div>
          <span className="lbl">Tracking ID</span>
          <div className="flex flex-wrap items-center gap-2"><code className="readonly mono break-all !text-base">{hasil?.tracking_id || '-'}</code><button type="button" className="btn-o py-1 text-xs" disabled={!hasil?.tracking_id} onClick={() => salin(String(hasil?.tracking_id || ''), 'Tracking ID')}><Copy size={13} /> Salin</button></div>
        </div>
        <p className="note-info">Kode OTP <b>6 digit</b> bisa dikirim ke <b>{String(f.email_ormas || 'email ormas Anda')}</b> atau ke <b>{String(f.nomor_whatsapp_ketua || 'nomor WhatsApp ketua')}</b>. Buka halaman Tracking Pendaftaran, pilih <b>Email</b> atau <b>WhatsApp</b>, lalu klik <b>Kirim OTP</b>. Kode berlaku 10 menit.</p>
        <p className="note-warn">Tracking ID saja tidak membuka data pendaftaran. Pastikan email/WhatsApp ormas bisa menerima pesan masuk.</p>
        <div className="flex flex-wrap gap-2"><button type="button" className="btn-o" onClick={unduhInfo}><Download size={15} /> Unduh info tracking</button><Link to="/tracking" className="btn-p">Lacak pendaftaran</Link></div>
      </div>
      <div className="mt-5 text-center"><Link to="/" className="txt-link">Kembali ke Beranda</Link></div>
    </div>
  );
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
      <section className="pub-hero">
        <div className="photo kenburns -z-20" style={{ backgroundImage: "url('/bg-tugu.jpg')" }} aria-hidden="true" />
        <div className="hero-chip"><span className="h-1.5 w-1.5 rounded-full bg-gold-soft" /> Formulir Publik · Bidang Poldagri</div>
        <h1 className="display mt-4 text-3xl text-white md:text-4xl">Pendaftaran Ormas Baru</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-200">Isi data ormas Anda. Data diperiksa admin dan baru tampil di katalog setelah disetujui.</p>
      </section>
      <p className="mt-4 text-xs text-muted">Keterangan: <Tag wajib /> harus dilengkapi sebelum mengirim. <Tag wajib={false} /> boleh dikosongkan.</p>
      <form onSubmit={submit} className="pub-card-solid mt-4 grid gap-3 p-4 sm:p-6 md:grid-cols-2">
        <section className="pub-group md:col-span-2">
          {H('Identitas Ormas', true)}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {T('nama_ormas', 'Nama ormas', { max: 200, req: true })}
            <div><label className="lbl" htmlFor="kat">Kategori / bidang ormas</label><input id="kat" className="inp" list="kat-list" maxLength={100} required placeholder="Pilih dari daftar atau ketik kategori sendiri" value={kat} onChange={(e) => setKat(e.target.value)} /><datalist id="kat-list">{(meta?.categories || []).map((c: any) => <option key={c.id} value={c.nama_kategori} />)}</datalist></div>
            <div><label className="lbl" htmlFor="bentuk">Bentuk ormas</label><select id="bentuk" className="inp" required value={bp} onChange={(e) => setBp(e.target.value)}><option value="">Pilih bentuk ormas</option>{BENTUK.map((b) => <option key={b}>{b}</option>)}</select></div>
            <div><label className="lbl" htmlFor="km">Kemantren</label><select id="km" className="inp" required value={f.kemantren} onChange={(e) => set('kemantren', e.target.value)}><option value="">Pilih kemantren</option>{KEMANTREN.map((k: string) => <option key={k}>{k}</option>)}</select></div>
            {bp === 'LAINNYA' && <div className="sm:col-span-2 md:col-span-3"><label className="lbl" htmlFor="bl">Masukkan Bentuk Ormas</label><input id="bl" className="inp" maxLength={100} required placeholder="Tulis bentuk ormas Anda" value={bl} onChange={(e) => setBl(e.target.value)} /></div>}
            {T('bidang_kegiatan', 'Bidang kegiatan', { max: 300, req: true })}
          </div>
        </section>

        <section className="pub-group md:col-span-2">
          {H('Logo Ormas', true)}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="lbl" htmlFor="lg">Unggah logo ormas</label>
              <input id="lg" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" className="text-sm" onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ''; }} />
              <p className="mt-1 text-xs text-muted">Format PNG, JPG, atau JPEG · rasio 1:1, rekomendasi 512 × 512 px · maksimal 1 MB (ideal di bawah 500 KB).</p>
              {logoUrl && <button type="button" className="mt-1 text-xs text-bad underline" onClick={() => { setLogo(null); setLogoUrl(''); setLogoWarn([]); }}>hapus logo</button>}
            </div>
            <div>
              {logoUrl ? <div className="flex items-start gap-3"><img src={logoUrl} alt="Pratinjau logo ormas" className="h-24 w-24 shrink-0 rounded-2xl border border-line bg-white object-contain" /><div className="min-w-0 text-xs"><p className="font-semibold">{logo?.name} ({fmtSize(logo?.size || 0)})</p>{logoWarn.map((w) => <p key={w} className="note-warn mt-1 !p-1.5 !text-xs">⚠ {w}</p>)}</div></div> : <p className="note-info !text-xs">Logo belum dipilih. Pratinjau dan pemeriksaan ukuran akan tampil di sini setelah berkas dipilih.</p>}
            </div>
          </div>
        </section>

        <section className="pub-group md:col-span-2">
          {H('Nama Pengurus', true)}
          <div className="grid gap-3 sm:grid-cols-3">
            {T('nama_ketua', 'Ketua', { req: true })}
            {T('sekretaris', 'Sekretaris', { req: true })}
            {T('bendahara', 'Bendahara', { req: true })}
          </div>
        </section>

        <section className="pub-group md:col-span-2">
          {H('Kontak dan Alamat', true)}
          <div className="grid gap-3 sm:grid-cols-2">
            {T('nomor_whatsapp_ketua', 'Nomor telepon pribadi ketua (untuk konfirmasi dari kami)', { type: 'tel', ph: '081234567890', req: true, max: 25 })}
            {T('telepon_ormas', 'Nomor telepon resmi ormas', { type: 'tel', ph: '0274 000 0000', max: 25 })}
            <p className="col-span-full text-xs text-muted">Nomor ketua bersifat pribadi dan hanya ditampilkan tersamarkan di katalog publik. Nomor telepon ormas adalah kontak resmi organisasi dan ditampilkan lengkap di katalog.</p>
            {T('email_ormas', 'Email ormas', { type: 'email', req: true })}
            <div><label className="lbl" htmlFor="al">Alamat kantor / sekretariat</label><textarea id="al" rows={2} maxLength={500} required className="inp" value={f.alamat} onChange={(e) => set('alamat', e.target.value)} /></div>
          </div>
        </section>

        <section className="pub-group md:col-span-2">
          {H('Jumlah Anggota', true)}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {MEM.map(([k, l]) => <div key={k}><label className="lbl" htmlFor={k}>{l}</label><input id={k} type="number" min={0} max={9999999} step={1} inputMode="numeric" required className="inp" placeholder="0" value={f[k] ?? ''} onChange={(e) => set(k, e.target.value.replace(/\D/g, ''))} /></div>)}
          </div>
          <p className="mt-2 text-xs text-muted">Isi angka saja (tanpa nama anggota). Isi 0 bila tidak ada. Rincian perempuan, lansia, dan disabilitas boleh saling beririsan, tetapi tiap rincian tidak boleh lebih besar dari total.</p>
        </section>

        <section className="pub-group md:col-span-2">
          {H('Dokumen Tambahan', true)}
          <div className="grid gap-3 sm:grid-cols-2">{FileBox(ADART[0], 'AD/ART (PDF)')}{FileBox(COMPANY_PROFILE[0], 'Company Profile ormas (PDF / PPT / PPTX, tampil terbuka di katalog)')}</div>
          <div className="mt-3"><CompanyProfileGuide compact /></div>
          <CpChecklist ringkas value={f.cp_bagian} onChange={(v) => set('cp_bagian', v)} />
        </section>

        <section className="pub-group md:col-span-2">
          {H('Legal Standing', true)}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4"><LegalStatusFields f={f} set={set} padat /></div>
        </section>

        <section className="pub-group md:col-span-2">
          {H(`Dokumen PDF (maks. ${maxMb} MB per file)`, false)}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{DOC_TYPES.filter(([j]: string[]) => j !== 'skto').map(([j, l]: string[]) => FileBox(j, l))}{FileBox(DOKUMENTASI[0], 'Laporan kegiatan tahunan (PDF)')}</div>
        </section>

        <section className="pub-group md:col-span-2">
          {H('Tautan Dokumentasi dan Media Sosial', false)}
          <div className="grid gap-3 sm:grid-cols-2"><LinkInputs ringkas padat f={f} set={set} /></div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
          <p className="text-xs text-muted">Setelah dikirim, simpan Tracking ID untuk mengecek status lewat halaman Tracking Pendaftaran.</p>
          <button className="btn-p" disabled={busy}><Send size={16} /> {busy ? 'Mengirim…' : 'Kirim pendaftaran'}</button>
        </div>
      </form>
    </div>
  );
}
