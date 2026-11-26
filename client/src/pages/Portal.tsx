import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ExternalLink, KeyRound, LogOut, Moon, Save, Sun, Upload } from 'lucide-react';
import { api } from '../api';
import { ANGGOTA_KEYS, BerlakuInput, Badge, DOC_TYPES, ADART, COMPANY_PROFILE, CompanyProfileGuide, CpChecklist, CpStatus, DOKUMENTASI, docAccept, docTypeOk, ErrorBox, KEMANTREN, LinkInputs, Loading, MemberInputs, Modal, Spinner, fmtDate, fmtSize, useFetch, useToast } from '../ui';
import { ChangePassword, PasswordInput, Shell } from './AdminAuth';
import { useTheme } from '../theme';

export function PortalLogin() {
  const nav = useNavigate(); const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => { e.preventDefault(); if (busy) return; setBusy(true); setErr(''); try { await api('/portal/login', { body: { username: u.trim(), password: p } }); nav('/portal'); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  return (
    <Shell title="Login Ormas">
      <p className="note-info mb-4 !text-xs">Khusus untuk mengubah data dan dokumen ormas Anda sendiri. Username dan password ini <b>berbeda</b> dari password harian untuk membuka PDF terbatas.</p>
      <form onSubmit={go} className="space-y-4">
        <div><label className="lbl" htmlFor="pu">Username ormas</label><input id="pu" className="inp" autoComplete="username" placeholder="Contoh: ormas009" required value={u} onChange={(e) => setU(e.target.value)} /></div>
        <PasswordInput id="pp" label="Password" value={p} onChange={setP} />
        {err && <p className="note-bad !text-bad" role="alert">{err}</p>}
        <button className="btn-p w-full" disabled={busy}>{busy ? <><Spinner /> Memeriksa…</> : 'Login'}</button>
        <Link to="/ormas-login/lupa" className="txt-link block text-center text-sm">Lupa Password?</Link>
      </form>
    </Shell>
  );
}

export function PortalForgot() {
  const [email, setEmail] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const go = async (e: React.FormEvent) => { e.preventDefault(); if (busy) return; setBusy(true); setErr(''); try { await api('/portal/forgot', { body: { email } }); setDone(true); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  return (
    <Shell title="Pemulihan Password Ormas">
      {done ? <p className="text-sm text-body">Jika email tersebut terdaftar sebagai email ormas, tautan pemulihan sudah dikirim dan berlaku 30 menit. Periksa kotak masuk dan folder spam.</p> : (
        <form onSubmit={go} className="space-y-4"><div><label className="lbl" htmlFor="pe">Email ormas yang terdaftar</label><input id="pe" type="email" className="inp" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {err && <p className="note-bad !text-bad" role="alert">{err}</p>}<button className="btn-p w-full" disabled={busy}>Kirim tautan pemulihan</button></form>)}
      <Link to="/ormas-login" className="txt-link mt-4 block text-center text-sm">Kembali ke login</Link>
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
        {err && <p className="note-bad !text-bad" role="alert">{err}</p>}<button className="btn-p w-full" disabled={busy}>Simpan password</button></form>
    </Shell>
  );
}

const KEYS = ['bentuk', 'bidang_kegiatan', 'kemantren', 'nama_ketua', 'sekretaris', 'bendahara', 'nomor_whatsapp_ketua', 'email_ormas', 'alamat', 'legal_jenis', 'nomor_sk', 'legal_tahun', 'legal_berlaku_sd', 'skto_nomor', 'skto_tahun', 'skto_berlaku_sd', ...ANGGOTA_KEYS, 'link_dokumentasi', 'link_instagram', 'link_youtube', 'link_tiktok', 'cp_bagian'];

export function PortalHome() {
  const nav = useNavigate(); const toast = useToast(); const [theme, toggleTheme] = useTheme();
  const [me, setMe] = useState<any>(null); const [err, setErr] = useState('');
  const load = () => api('/portal/me').then(setMe).catch((e) => (e.status === 401 ? nav('/ormas-login', { replace: true }) : setErr(e.message)));
  useEffect(() => { load(); }, []);
  const { data: meta } = useFetch<any>('/public/meta');
  const [f, setF] = useState<any>({}); const [logo, setLogo] = useState<File | null>(null); const [rmLogo, setRmLogo] = useState(false);
  const [files, setFiles] = useState<Record<string, File>>({}); const [busy, setBusy] = useState(false); const [view, setView] = useState<any>(null); const [pw, setPw] = useState(false);
  useEffect(() => { if (me) setF(Object.fromEntries(KEYS.map((k) => [k, me[k] ?? '']))); }, [me]);
  if (err) return <div className="p-6"><ErrorBox text={err} retry={load} /></div>;
  if (!me) return <Loading />;
  if (me.must_change) return <ChangePassword path="/portal/change-password" onDone={load} />;
  const maxMb = meta?.max_pdf_mb || 20;
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const T = (k: string, label: string, o: any = {}) => <div className={o.span ? 'md:col-span-2' : ''}><label className="lbl" htmlFor={k}>{label}</label><input id={k} type={o.type || 'text'} className="inp" placeholder={o.ph} maxLength={o.max} value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} /></div>;
  const H = (t: string) => <h3 className="form-h">{t}</h3>;
  const pick = (j: string, x?: File) => {
    if (!x) return; if (!docTypeOk(j, x)) return toast(`"${x.name}" format tidak didukung${j === 'company_profile' ? ' (PDF, PPT, atau PPTX)' : ' (harus PDF)'}`, false); if (x.size > maxMb * 1048576) return toast(`"${x.name}" melebihi ${maxMb} MB`, false);
    setFiles((p) => ({ ...p, [j]: x }));
  };
  const uploadLaporan = async () => {
    if (busy || !files.dokumentasi) return; setBusy(true);
    const fd = new FormData(); KEYS.forEach((k) => fd.append(k, String(f[k] ?? ''))); fd.append('dokumentasi', files.dokumentasi);
    try { await api('/portal/profile', { method: 'PUT', form: fd }); toast('Laporan kegiatan tahunan terkirim dan menunggu verifikasi admin.'); setFiles((p) => { const n = { ...p }; delete n.dokumentasi; return n; }); await load(); }
    catch (x: any) { toast(x.message, false); } finally { setBusy(false); }
  };
  const logout = async () => { await api('/portal/logout', { method: 'POST', body: {} }).catch(() => {}); nav('/ormas-login'); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    const tot = f.anggota_total === '' ? null : +f.anggota_total; const rinci = ['anggota_perempuan', 'anggota_lansia', 'anggota_disabilitas'];
    if (tot == null && rinci.some((k) => f[k] !== '')) return toast('Isi juga jumlah total anggota', false);
    if (tot != null && rinci.some((k) => f[k] !== '' && +f[k] > tot)) return toast('Rincian anggota tidak boleh lebih besar dari jumlah total', false);
    setBusy(true);
    const fd = new FormData(); KEYS.forEach((k) => fd.append(k, String(f[k] ?? ''))); Object.entries(files).forEach(([j, x]) => fd.append(j, x)); if (logo) fd.append('logo', logo); if (rmLogo) fd.append('remove_logo', '1');
    try {
      const r = await api('/portal/profile', { method: 'PUT', form: fd });
      toast(r.changed ? 'Perubahan terkirim dan menunggu verifikasi admin. Katalog baru berubah setelah diverifikasi.' : 'Tidak ada perubahan untuk disimpan');
      setFiles({}); setLogo(null); setRmLogo(false); await load();
    } catch (x: any) { toast(x.message, false); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 px-3 pt-3">
        <div className="topbar mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 rounded-2xl px-3 py-2.5">
          <Link to="/" className="flex items-center gap-2.5"><span className="brand-mark h-9 w-9"><Building2 size={18} /></span><span><span className="block text-sm font-extrabold leading-tight tracking-wide text-ink">SIDOMAS</span><span className="eyebrow block !text-[10px]">Portal Ormas</span></span></Link>
          <div className="flex gap-2">
            <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Pakai tema terang' : 'Pakai tema gelap'} title={theme === 'dark' ? 'Tema terang' : 'Tema gelap'}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
            <button className="btn-o" onClick={() => setPw(true)} aria-label="Ganti password"><KeyRound size={15} /> <span className="hidden sm:inline">Ganti password</span></button>
            <button className="btn-o" onClick={logout} aria-label="Keluar"><LogOut size={15} /> <span className="hidden sm:inline">Keluar</span></button>
          </div>
        </div>
      </header>
      <main className="stagger mx-auto max-w-4xl space-y-4 px-3 py-5 sm:px-4">
        <div className="card flex flex-wrap items-center gap-4 p-4">
          {me.has_logo ? <img src={`/api/logo/${me.kode_ormas}?${me.logo_pending ? 'pending=1&' : ''}v=${encodeURIComponent(me.updated_at)}`} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <span className="brand-mark h-16 w-16 !rounded-2xl"><Building2 /></span>}
          <div className="min-w-0 flex-1"><p className="eyebrow">{me.kode_ormas} · {me.nama_kategori}</p><h1 className="text-xl font-bold text-ink">{me.nama_ormas}</h1><div className="mt-1 flex flex-wrap items-center gap-2 text-xs"><Badge s={me.status_dokumen} /><span className="text-muted">Diperbarui {fmtDate(me.updated_at)}</span></div></div>
        </div>
        {me.pending && <p className="note-info"><b>Perubahan Anda menunggu verifikasi admin.</b> Katalog publik dan penyimpanan dokumen masih memakai data lama sampai admin memverifikasinya. Anda masih bisa menyunting dan menyimpan ulang perubahan ini.</p>}
        {!me.pending && me.catatan_penolakan && <p className="note-bad"><b>Perubahan terakhir Anda ditolak admin.</b> {me.catatan_penolakan}</p>}
        <p className="note-warn">Anda hanya dapat mengubah data ormas Anda sendiri. Setiap kali Anda menyimpan perubahan, status dokumen otomatis menjadi <b>Perlu Diverifikasi</b>, dan data baru tampil di katalog setelah admin memverifikasinya. Nama ormas, kategori, dan status hanya dapat diubah admin.</p>
        <form onSubmit={save} className="card-solid grid gap-4 p-4 sm:p-6 md:grid-cols-2">
          {H('Unggah Laporan Kegiatan Tahunan')}
          {(() => { const j = 'dokumentasi'; const cur = me.docs.find((d: any) => d.jenis_dokumen === j); return (
            <div className={`drop md:col-span-2 ${files[j] || cur ? 'drop-on' : ''}`}>
              <label className="lbl" htmlFor="f_dok">Laporan kegiatan tahunan (PDF, maks. {maxMb} MB)</label>
              <div className="flex flex-wrap items-center gap-2">
                <input id="f_dok" type="file" accept="application/pdf" className="min-w-0 flex-1 text-xs" onChange={(e) => { pick(j, e.target.files?.[0]); e.target.value = ''; }} />
                <button type="button" className="btn-p" disabled={busy || !files[j]} onClick={uploadLaporan}><Upload size={16} /> {busy ? 'Mengunggah…' : 'Upload'}</button>
              </div>
              <p className="mt-1 text-xs text-muted">{files[j] ? <>Siap diunggah: <b>{files[j].name}</b> ({fmtSize(files[j].size)}). Klik <b>Upload</b>.</> : cur ? <>Tersimpan: {cur.nama_file} ({fmtSize(cur.ukuran_file)}). Mengunggah lagi akan menggantikan laporan ini.</> : 'Belum ada laporan. Berkas masuk ke folder Google Drive ormas Anda setelah diverifikasi admin.'}</p>
            </div>); })()}
          {H('Identitas')}
          {T('bentuk', 'Bentuk', { ph: 'Mis. Perkumpulan, Yayasan' })}
          <div><label className="lbl" htmlFor="km">Kemantren</label><select id="km" className="inp" value={f.kemantren ?? ''} onChange={(e) => set('kemantren', e.target.value)}><option value="">Pilih kemantren</option>{KEMANTREN.map((k) => <option key={k}>{k}</option>)}</select></div>
          {T('bidang_kegiatan', 'Bidang kegiatan', { span: true, max: 300 })}
          <div className="md:col-span-2"><label className="lbl" htmlFor="lg">Logo ormas</label><input id="lg" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => setLogo(e.target.files?.[0] || null)} />{me.has_logo && !logo && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" checked={rmLogo} onChange={(e) => setRmLogo(e.target.checked)} />Hapus logo saat ini</label>}</div>
          {H('Nama Pengurus')}
          {T('nama_ketua', 'Ketua')}{T('sekretaris', 'Sekretaris')}{T('bendahara', 'Bendahara')}{T('nomor_whatsapp_ketua', 'Nomor telepon / WhatsApp ketua', { type: 'tel', ph: '081234567890' })}
          {H('Kontak dan Alamat')}
          {T('email_ormas', 'Email ormas (dipakai untuk pemulihan password)', { type: 'email', span: true })}
          <div className="md:col-span-2"><label className="lbl" htmlFor="al">Alamat kantor / sekretariat <span className="font-normal text-muted">(tulis selengkap mungkin, dipakai untuk peta di halaman publik)</span></label><textarea id="al" rows={2} maxLength={500} className="inp" value={f.alamat ?? ''} onChange={(e) => set('alamat', e.target.value)} /></div>
          {H('Jumlah Anggota')}
          <MemberInputs f={f} set={set} />
          {H('Legal Standing')}
          {T('legal_jenis', 'Jenis')}{T('nomor_sk', 'Nomor')}{T('legal_tahun', 'Tahun', { max: 4, ph: '2021' })}<BerlakuInput id="legal_berlaku_sd" label="Berlaku s/d" forever value={f.legal_berlaku_sd ?? ''} onChange={(v) => set('legal_berlaku_sd', v)} />
          {H('SKTO')}
          {T('skto_nomor', 'Nomor')}{T('skto_tahun', 'Tahun', { max: 4, ph: '2024' })}<BerlakuInput id="skto_berlaku_sd" label="Berlaku s/d" value={f.skto_berlaku_sd ?? ''} onChange={(v) => set('skto_berlaku_sd', v)} />
          {H(`Dokumen PDF (maks. ${maxMb} MB per file)`)}
          <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
            {DOC_TYPES.map(([j, l]) => { const cur = me.docs.find((d: any) => d.jenis_dokumen === j); return (
              <div key={j} className={`drop ${files[j] || cur ? 'drop-on' : ''}`}>
                <label className="lbl" htmlFor={'f_' + j}>{l}</label>
                <input id={'f_' + j} type="file" accept="application/pdf" className="w-full text-xs" onChange={(e) => { pick(j, e.target.files?.[0]); e.target.value = ''; }} />
                <p className="mt-1 text-xs text-muted">{files[j] ? <>Akan diunggah: <b>{files[j].name}</b> ({fmtSize(files[j].size)}) <button type="button" className="text-bad underline" onClick={() => setFiles((p) => { const n = { ...p }; delete n[j]; return n; })}>batal</button></> : cur ? <>Tersimpan: {cur.nama_file} ({fmtSize(cur.ukuran_file)}){cur.pending ? ' · menunggu verifikasi admin' : ''}. Pilih file baru untuk mengganti.</> : 'Belum diunggah'}</p>
                {cur && <button type="button" className="mt-1 text-xs font-semibold text-link underline" onClick={() => setView(view?.id === cur.id ? null : cur)}><ExternalLink size={12} className="mr-1 inline" />{view?.id === cur.id ? 'Tutup PDF' : 'Lihat PDF tersimpan'}</button>}
              </div>); })}
          </div>
          {H('Dokumen Tambahan (opsional)')}
        <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
          {[ADART, COMPANY_PROFILE].map(([j, l]) => { const cur = me.docs.find((d: any) => d.jenis_dokumen === j); return (
            <div key={j} className={`drop ${files[j] || cur ? 'drop-on' : ''}`}>
              <label className="lbl" htmlFor={'f_' + j}>{l}{j === 'company_profile' ? ' (PDF / PPT / PPTX, tampil terbuka di katalog)' : ' (PDF)'}</label>
              <input id={'f_' + j} type="file" accept={docAccept(j)} className="w-full text-xs" onChange={(e) => { pick(j, e.target.files?.[0]); e.target.value = ''; }} />
              <p className="mt-1 text-xs text-muted">{files[j] ? <>Akan diunggah: <b>{files[j].name}</b> ({fmtSize(files[j].size)}) <button type="button" className="text-bad underline" onClick={() => setFiles((p) => { const n = { ...p }; delete n[j]; return n; })}>batal</button></> : cur ? <>Tersimpan: {cur.nama_file} ({fmtSize(cur.ukuran_file)}){cur.pending && ' · menunggu verifikasi'}</> : 'Belum diunggah'}</p>
            </div>); })}
        </div>
        <CompanyProfileGuide />
        <div className="md:col-span-2"><CpStatus cpBagian={f.cp_bagian} hasFile={me.docs.some((d: any) => d.jenis_dokumen === 'company_profile')} /></div>
        <CpChecklist value={f.cp_bagian ?? ''} onChange={(v) => set('cp_bagian', v)} />
        {H('Tautan Dokumentasi dan Media Sosial (opsional)')}
          <LinkInputs f={f} set={set} />

          {view && <iframe title={view.nama_file} src={`/api/portal/files/${view.id}`} className="h-[60vh] w-full rounded-xl border border-line bg-white md:col-span-2" />}
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
        {err && <p className="note-bad !text-bad" role="alert">{err}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn-o" onClick={onClose}>Batal</button><button className="btn-p" disabled={busy}>Simpan</button></div></form>
    </Modal>
  );
}
