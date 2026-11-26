import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Send } from 'lucide-react';
import { api } from '../api';
import { ADART, BerlakuInput, COMPANY_PROFILE, CompanyProfileGuide, CpChecklist, DOC_TYPES, DOKUMENTASI, KEMANTREN, LinkInputs, docAccept, docTypeOk, fmtSize, useFetch, useToast } from '../ui';

const BENTUK = ['YAYASAN', 'PERKUMPULAN', 'LEMBAGA', 'PAGUYUBAN', 'LAINNYA'];
const MEM: [string, string][] = [['anggota_total', 'Total anggota'], ['anggota_perempuan', 'Anggota perempuan'], ['anggota_lansia', 'Anggota lansia'], ['anggota_disabilitas', 'Anggota disabilitas']];
const KEYS = ['bidang_kegiatan', 'kemantren', 'nama_ketua', 'sekretaris', 'bendahara', 'nomor_whatsapp_ketua', 'telepon_ormas', 'email_ormas', 'alamat', 'legal_status', 'legal_jenis', 'nomor_sk', 'legal_tahun', 'legal_berlaku_sd', ...MEM.map(([k]) => k), 'link_dokumentasi', 'link_instagram', 'link_youtube', 'link_tiktok', 'cp_bagian'];
const Tag = ({ wajib }: { wajib: boolean }) => <span className={`ml-2 rounded px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase ${wajib ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>{wajib ? 'Wajib diisi' : 'Opsional'}</span>;

// Pendaftaran ormas baru (publik). Setiap kolom diberi label "Wajib diisi" atau "Opsional".
export function Daftar() {
  const toast = useToast(); const { data: meta } = useFetch<any>('/public/meta');
  const [kat, setKat] = useState(''); const [bp, setBp] = useState(''); const [bl, setBl] = useState('');
  const [f, setF] = useState<any>(Object.fromEntries(KEYS.map((k) => [k, ''])));
  const [logo, setLogo] = useState<File | null>(null); const [logoUrl, setLogoUrl] = useState(''); const [logoWarn, setLogoWarn] = useState<string[]>([]);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const maxMb = meta?.max_pdf_mb || 20;
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const T = (k: string, label: string, o: any = {}) => <div className={o.span ? 'md:col-span-2' : ''}><label className="lbl" htmlFor={k}>{label}<Tag wajib={!!o.req} /></label><input id={k} type={o.type || 'text'} className="inp" placeholder={o.ph} maxLength={o.max} required={o.req} value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} /></div>;
  const H = (t: string, wajib: boolean) => <h3 className="border-b border-slate-200 pb-1 pt-2 font-serif font-bold text-navy-900 md:col-span-2">{t}<Tag wajib={wajib} /></h3>;
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
  const FileBox = (j: string, l: string, req = false) => (
    <div key={j} className={`rounded-md border p-3 ${files[j] ? 'border-green-300 bg-green-50' : 'border-slate-200'}`}>
      <label className="lbl" htmlFor={'f_' + j}>{l}<Tag wajib={req} /></label>
      <input id={'f_' + j} type="file" accept={docAccept(j)} className="w-full text-xs" onChange={(e) => { pick(j, e.target.files?.[0]); e.target.value = ''; }} />
      {files[j] && <p className="mt-1 text-xs text-slate-600">{files[j].name} ({fmtSize(files[j].size)}) <button type="button" className="text-red-600 underline" onClick={() => setFiles((p) => { const n = { ...p }; delete n[j]; return n; })}>batal</button></p>}
    </div>
  );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    const bentuk = bp === 'LAINNYA' ? bl.trim() : bp;
    if (!bentuk) return toast('Bentuk ormas wajib diisi', false);
    if (!logo) return toast('Logo ormas wajib diunggah', false);
    if (!f.legal_status) return toast('Pilih YA atau TIDAK pada pertanyaan Legal Standing', false);
    if (!files.adart) return toast('Dokumen AD/ART wajib diunggah', false);
    if (!files.company_profile) return toast('Company Profile wajib diunggah', false);
    const tot = +f.anggota_total; if (['anggota_perempuan', 'anggota_lansia', 'anggota_disabilitas'].some((k) => +f[k] > tot)) return toast('Jumlah perempuan, lansia, dan disabilitas tidak boleh lebih besar dari total anggota', false);
    setBusy(true);
    const fd = new FormData(); fd.append('nama_ormas', String(f.nama_ormas ?? '').trim()); fd.append('kategori_nama', kat); fd.append('bentuk', bentuk);
    // Jika belum memiliki Legal Standing, isian dokumen Legal Standing tidak dikirim (status "tidak" tetap dikirim)
    const LEGAL = ['legal_jenis', 'nomor_sk', 'legal_tahun', 'legal_berlaku_sd'];
    KEYS.forEach((k) => fd.append(k, f.legal_status === 'tidak' && LEGAL.includes(k) ? '' : String(f[k] ?? ''))); Object.entries(files).forEach(([j, x]) => fd.append(j, x)); fd.append('logo', logo);
    try { await api('/public/daftar', { method: 'POST', form: fd }); setDone(true); window.scrollTo(0, 0); } catch (x: any) { toast(x.message, false); } finally { setBusy(false); }
  };
  if (done) return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center"><CheckCircle2 className="mx-auto text-green-600" size={48} />
      <h1 className="mt-3 font-serif text-2xl font-bold text-navy-900">Pendaftaran terkirim</h1>
      <p className="mt-2 text-slate-600">Data ormas Anda sudah masuk dan berstatus <b>Tindak Lanjuti</b>. Setelah admin menyetujui, ormas Anda tampil di katalog dan akun portal diberikan oleh admin.</p>
      <Link to="/" className="btn-p mt-6 inline-flex">Kembali ke Beranda</Link></div>
  );
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-serif text-2xl font-bold text-navy-900">Pendaftaran Ormas Baru</h1>
      <p className="mt-1 text-sm text-slate-600">Isi data ormas Anda. Data diperiksa admin dan baru tampil di katalog setelah disetujui.</p>
      <p className="mt-2 text-xs text-slate-600">Keterangan: <Tag wajib /> harus dilengkapi sebelum mengirim. <Tag wajib={false} /> boleh dikosongkan.</p>
      <form onSubmit={submit} className="card mt-4 grid gap-4 p-4 md:grid-cols-2">
        {H('Identitas Ormas', true)}
        {T('nama_ormas', 'Nama ormas', { span: true, max: 200, req: true })}
        <div className="md:col-span-2"><label className="lbl" htmlFor="kat">Kategori / bidang ormas<Tag wajib /></label><input id="kat" className="inp" list="kat-list" maxLength={100} required placeholder="Pilih dari daftar atau ketik kategori sendiri" value={kat} onChange={(e) => setKat(e.target.value)} /><datalist id="kat-list">{(meta?.categories || []).map((c: any) => <option key={c.id} value={c.nama_kategori} />)}</datalist></div>
        <div><label className="lbl" htmlFor="bentuk">Bentuk ormas<Tag wajib /></label><select id="bentuk" className="inp" required value={bp} onChange={(e) => setBp(e.target.value)}><option value="">Pilih bentuk ormas</option>{BENTUK.map((b) => <option key={b}>{b}</option>)}</select></div>
        <div><label className="lbl" htmlFor="km">Kemantren<Tag wajib /></label><select id="km" className="inp" required value={f.kemantren} onChange={(e) => set('kemantren', e.target.value)}><option value="">Pilih kemantren</option>{KEMANTREN.map((k: string) => <option key={k}>{k}</option>)}</select></div>
        {bp === 'LAINNYA' && <div className="md:col-span-2"><label className="lbl" htmlFor="bl">Masukkan Bentuk Ormas<Tag wajib /></label><input id="bl" className="inp" maxLength={100} required placeholder="Tulis bentuk ormas Anda" value={bl} onChange={(e) => setBl(e.target.value)} /></div>}
        {T('bidang_kegiatan', 'Bidang kegiatan', { span: true, max: 300, req: true })}

        {H('Logo Ormas', true)}
        <div className="md:col-span-2">
          <label className="lbl" htmlFor="lg">Unggah logo ormas<Tag wajib /></label>
          <input id="lg" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" className="text-sm" onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ''; }} />
          <ul className="mt-1 list-disc pl-5 text-xs text-slate-600"><li>Format: PNG, JPG, atau JPEG.</li><li>Rasio gambar 1:1 (persegi), rekomendasi resolusi 512 × 512 px.</li><li>Ukuran ideal di bawah 500 KB, maksimal 1 MB.</li></ul>
          {logoUrl && <div className="mt-2 flex items-start gap-3"><img src={logoUrl} alt="Pratinjau logo ormas" className="h-24 w-24 rounded border border-slate-200 bg-white object-contain" /><div className="text-xs"><p className="font-semibold">{logo?.name} ({fmtSize(logo?.size || 0)})</p>{logoWarn.map((w) => <p key={w} className="mt-1 rounded bg-amber-50 p-1.5 text-amber-800">⚠ {w}</p>)}<button type="button" className="mt-1 text-red-600 underline" onClick={() => { setLogo(null); setLogoUrl(''); setLogoWarn([]); }}>hapus logo</button></div></div>}
        </div>

        {H('Nama Pengurus', true)}
        {T('nama_ketua', 'Ketua', { req: true })}{T('sekretaris', 'Sekretaris', { req: true })}{T('bendahara', 'Bendahara', { req: true })}

        {H('Kontak dan Alamat', true)}
        {T('nomor_whatsapp_ketua', 'Nomor Telepon Ketua (nomor pribadi; untuk konfirmasi dari kami, ditampilkan samar di katalog)', { type: 'tel', ph: '081234567890', req: true })}
        {T('telepon_ormas', 'Nomor Telepon Ormas (nomor kontak resmi organisasi)', { type: 'tel', ph: '0274123456', req: true })}
        {T('email_ormas', 'Email ormas', { type: 'email', req: true, span: true })}
        <div className="md:col-span-2"><label className="lbl" htmlFor="al">Alamat kantor / sekretariat<Tag wajib /></label><textarea id="al" rows={2} maxLength={500} required className="inp" value={f.alamat} onChange={(e) => set('alamat', e.target.value)} /></div>

        {H('Jumlah Anggota', true)}
        {MEM.map(([k, l]) => <div key={k}><label className="lbl" htmlFor={k}>{l}<Tag wajib /></label><input id={k} type="number" min={0} max={9999999} step={1} inputMode="numeric" required className="inp" placeholder="0" value={f[k] ?? ''} onChange={(e) => set(k, e.target.value.replace(/\D/g, ''))} /></div>)}
        <p className="text-xs text-slate-500 md:col-span-2">Isi angka saja (tanpa nama anggota). Isi 0 bila tidak ada. Rincian perempuan, lansia, dan disabilitas boleh saling beririsan, tetapi tiap rincian tidak boleh lebih besar dari total.</p>

        {H('Dokumen Tambahan', true)}
        <div className="grid gap-3 md:col-span-2 md:grid-cols-2">{FileBox(ADART[0], 'AD/ART (PDF)', true)}{FileBox(COMPANY_PROFILE[0], 'Company Profile ormas (PDF / PPT / PPTX, tampil terbuka di katalog)', true)}</div>
        <CompanyProfileGuide />
        <CpChecklist value={f.cp_bagian} onChange={(v) => set('cp_bagian', v)} />

        {H('Legal Standing', true)}
        <div className="md:col-span-2">
          <p className="lbl">Apakah sudah memiliki Legal Standing?<Tag wajib /></p>
          <div className="flex gap-6">{[['ya', 'YA'], ['tidak', 'TIDAK']].map(([v, l]) => <label key={v} className="flex items-center gap-2 text-sm"><input type="radio" name="legal_status" value={v} required checked={f.legal_status === v} onChange={() => set('legal_status', v)} />{l}</label>)}</div>
        </div>
        {f.legal_status === 'ya' && <>{T('legal_jenis', 'Jenis Legal Standing')}{T('nomor_sk', 'Nomor Legal Standing')}{T('legal_tahun', 'Tahun', { max: 4, ph: '2021' })}<BerlakuInput id="legal_berlaku_sd" label="Berlaku sampai" forever value={f.legal_berlaku_sd ?? ''} onChange={(v: string) => set('legal_berlaku_sd', v)} /></>}
        {f.legal_status === 'tidak' && <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900 md:col-span-2">Anda Tidak Bisa Mengisi Karena Tidak Memiliki Legal Standing.</p>}
        {H(`Dokumen PDF (maks. ${maxMb} MB per file)`, false)}
        <div className="grid gap-3 md:col-span-2 md:grid-cols-2">{DOC_TYPES.filter(([j]: string[]) => j !== 'skto').map(([j, l]: string[]) => FileBox(j, l))}{FileBox(DOKUMENTASI[0], 'Laporan kegiatan tahunan (PDF)')}</div>
        {H('Tautan Dokumentasi dan Media Sosial', false)}
        <LinkInputs f={f} set={set} />
        <div className="flex justify-end md:col-span-2"><button className="btn-p" disabled={busy}><Send size={16} /> {busy ? 'Mengirim…' : 'Kirim pendaftaran'}</button></div>
      </form>
    </div>
  );
}
