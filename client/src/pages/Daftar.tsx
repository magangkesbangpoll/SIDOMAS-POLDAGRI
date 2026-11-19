import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Send } from 'lucide-react';
import { api } from '../api';
import { ANGGOTA_KEYS, BerlakuInput, DOC_TYPES, DOKUMENTASI, KEMANTREN, LinkInputs, MemberInputs, fmtSize, useFetch, useToast } from '../ui';

const KEYS = ['bentuk', 'bidang_kegiatan', 'kemantren', 'nama_ketua', 'sekretaris', 'bendahara', 'nomor_whatsapp_ketua', 'email_ormas', 'alamat', 'legal_jenis', 'nomor_sk', 'legal_tahun', 'legal_berlaku_sd', ...ANGGOTA_KEYS, 'link_dokumentasi', 'link_instagram'];

// Pendaftaran ormas baru (publik). Isian sama dengan halaman ormas setelah login, tanpa SKTO;
// nama ormas dan kategori diisi sendiri oleh pendaftar.
export function Daftar() {
  const toast = useToast(); const { data: meta } = useFetch<any>('/public/meta');
  const [nama, setNama] = useState(''); const [kat, setKat] = useState('');
  const [f, setF] = useState<any>(Object.fromEntries(KEYS.map((k) => [k, ''])));
  const [logo, setLogo] = useState<File | null>(null); const [files, setFiles] = useState<Record<string, File>>({});
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const maxMb = meta?.max_pdf_mb || 20;
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const T = (k: string, label: string, o: any = {}) => <div className={o.span ? 'md:col-span-2' : ''}><label className="lbl" htmlFor={k}>{label}</label><input id={k} type={o.type || 'text'} className="inp" placeholder={o.ph} maxLength={o.max} required={o.req} value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} /></div>;
  const H = (t: string) => <h3 className="border-b border-slate-200 pb-1 pt-2 font-serif font-bold text-navy-900 md:col-span-2">{t}</h3>;
  const pick = (j: string, x?: File) => {
    if (!x) return; if (x.type !== 'application/pdf') return toast(`"${x.name}" bukan PDF`, false); if (x.size > maxMb * 1048576) return toast(`"${x.name}" melebihi ${maxMb} MB`, false);
    setFiles((p) => ({ ...p, [j]: x }));
  };
  const FileBox = (j: string, l: string) => (
    <div key={j} className={`rounded-md border p-3 ${files[j] ? 'border-green-300 bg-green-50' : 'border-slate-200'}`}>
      <label className="lbl" htmlFor={'f_' + j}>{l}</label>
      <input id={'f_' + j} type="file" accept="application/pdf" className="w-full text-xs" onChange={(e) => { pick(j, e.target.files?.[0]); e.target.value = ''; }} />
      {files[j] && <p className="mt-1 text-xs text-slate-600">{files[j].name} ({fmtSize(files[j].size)}) <button type="button" className="text-red-600 underline" onClick={() => setFiles((p) => { const n = { ...p }; delete n[j]; return n; })}>batal</button></p>}
    </div>
  );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    const tot = f.anggota_total === '' ? null : +f.anggota_total;
    if (tot == null && ['anggota_perempuan', 'anggota_lansia', 'anggota_disabilitas'].some((k) => f[k] !== '')) return toast('Isi juga jumlah total anggota', false);
    setBusy(true);
    const fd = new FormData(); fd.append('nama_ormas', nama); fd.append('kategori_nama', kat);
    KEYS.forEach((k) => fd.append(k, String(f[k] ?? ''))); Object.entries(files).forEach(([j, x]) => fd.append(j, x)); if (logo) fd.append('logo', logo);
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
      <p className="mt-1 text-sm text-slate-600">Isi data ormas Anda. Data diperiksa admin dan baru tampil di katalog setelah disetujui. Kolom bertanda * wajib diisi.</p>
      <form onSubmit={submit} className="card mt-4 grid gap-4 p-4 md:grid-cols-2">
        {H('Unggah Laporan Kegiatan Tahunan')}
        <div className="md:col-span-2">{FileBox(DOKUMENTASI[0], 'Laporan kegiatan tahunan (PDF, opsional)')}</div>
        {H('Identitas')}
        <div className="md:col-span-2"><label className="lbl" htmlFor="nama_ormas">Nama ormas *</label><input id="nama_ormas" className="inp" maxLength={200} required value={nama} onChange={(e) => setNama(e.target.value)} /></div>
        <div className="md:col-span-2"><label className="lbl" htmlFor="kat">Kategori / bidang ormas *</label><input id="kat" className="inp" list="kat-list" maxLength={100} required placeholder="Pilih dari daftar atau ketik kategori sendiri" value={kat} onChange={(e) => setKat(e.target.value)} /><datalist id="kat-list">{(meta?.categories || []).map((c: any) => <option key={c.id} value={c.nama_kategori} />)}</datalist></div>
        {T('bentuk', 'Bentuk', { ph: 'Mis. Perkumpulan, Yayasan' })}
        <div><label className="lbl" htmlFor="km">Kemantren</label><select id="km" className="inp" value={f.kemantren} onChange={(e) => set('kemantren', e.target.value)}><option value="">Pilih kemantren</option>{KEMANTREN.map((k: string) => <option key={k}>{k}</option>)}</select></div>
        {T('bidang_kegiatan', 'Bidang kegiatan', { span: true, max: 300 })}
        <div className="md:col-span-2"><label className="lbl" htmlFor="lg">Logo ormas</label><input id="lg" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => setLogo(e.target.files?.[0] || null)} /></div>
        {H('Nama Pengurus')}
        {T('nama_ketua', 'Ketua *', { req: true })}{T('sekretaris', 'Sekretaris')}{T('bendahara', 'Bendahara')}{T('nomor_whatsapp_ketua', 'Nomor WhatsApp ketua * (untuk konfirmasi dari kami)', { type: 'tel', ph: '081234567890', req: true, span: true })}
        {H('Kontak dan Alamat')}
        {T('email_ormas', 'Email ormas', { type: 'email', span: true })}
        <div className="md:col-span-2"><label className="lbl" htmlFor="al">Alamat kantor / sekretariat *</label><textarea id="al" rows={2} maxLength={500} required className="inp" value={f.alamat} onChange={(e) => set('alamat', e.target.value)} /></div>
        {H('Jumlah Anggota')}
        <MemberInputs f={f} set={set} />
        {H('Legal Standing')}
        {T('legal_jenis', 'Jenis')}{T('nomor_sk', 'Nomor')}{T('legal_tahun', 'Tahun', { max: 4, ph: '2021' })}<BerlakuInput id="legal_berlaku_sd" label="Berlaku s/d" forever value={f.legal_berlaku_sd ?? ''} onChange={(v: string) => set('legal_berlaku_sd', v)} />
        {H(`Dokumen PDF (maks. ${maxMb} MB per file)`)}
        <div className="grid gap-3 md:col-span-2 md:grid-cols-2">{DOC_TYPES.filter(([j]: string[]) => j !== 'skto').map(([j, l]: string[]) => FileBox(j, l))}</div>
        {H('Tautan Dokumentasi dan Media Sosial (opsional)')}
        <LinkInputs f={f} set={set} />
        <div className="flex justify-end md:col-span-2"><button className="btn-p" disabled={busy}><Send size={16} /> {busy ? 'Mengirim…' : 'Kirim pendaftaran'}</button></div>
      </form>
    </div>
  );
}
