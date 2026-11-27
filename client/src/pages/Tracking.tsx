import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3, Copy, Download, FileText, LockKeyhole, LogOut, Mail, MessageCircle, Search, Send, ShieldCheck, XCircle } from 'lucide-react';
import { api } from '../api';
import { docAccept, fmtDate, fmtSize, useToast } from '../ui';

type TrackingItem = {
  key: string;
  label: string;
  jenis: 'data' | 'dokumen' | 'logo';
  nilai: string;
  status: 'pending' | 'terverifikasi' | 'revisi';
  catatan: string;
  ukuran: number | null;
  url: string | null;
  bisa_diedit: boolean;
};

const hitung = (iso?: string | null) => {
  if (!iso) return null;
  const ms = Math.max(0, Date.parse(iso) - Date.now());
  const s = Math.floor(ms / 1000);
  return {
    habis: ms === 0,
    teks: `${Math.floor(s / 86400)} hari ${String(Math.floor((s % 86400) / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`,
  };
};

const warnaStatus = (s: string) => (s === 'disetujui' ? 'text-ok' : s === 'dikembalikan' || s === 'hangus' || s === 'ditolak' ? 'text-bad' : 'text-warn');

export function TrackingPage() {
  const toast = useToast();
  const [id, setId] = useState('');
  const [otp, setOtp] = useState('');
  const [channel, setChannel] = useState<'email' | 'wa'>('email');
  const [otpTerkirim, setOtpTerkirim] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [teks, setTeks] = useState<Record<string, string>>({});
  const [berkas, setBerkas] = useState<Record<string, File | null>>({});
  const [, setTick] = useState(0);

  const muat = async () => {
    try { setData(await api('/public/tracking')); return true; }
    catch { setData(null); return false; }
    finally { setLoading(false); }
  };
  useEffect(() => { muat(); }, []);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);

  const mintaOtp = async () => {
    if (!id.trim()) { setErr('Masukkan Tracking ID terlebih dahulu.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await api<{ message?: string }>('/public/tracking/otp', { method: 'POST', body: { tracking_id: id.trim().toUpperCase(), channel } });
      setOtpTerkirim(true);
      toast(r.message || 'Jika Tracking ID terdaftar, OTP sudah dikirim.');
    } catch (x: any) { setErr(x.message || 'Gagal mengirim OTP. Coba lagi beberapa saat.'); }
    finally { setBusy(false); }
  };

  const verifikasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim()) { setErr('Masukkan Tracking ID terlebih dahulu.'); return; }
    if (!otp.trim()) { setErr('Masukkan Kode OTP 6 digit yang dikirim ke email/WhatsApp Anda.'); return; }
    setBusy(true); setErr('');
    try {
      await api('/public/tracking/verify', { method: 'POST', body: { tracking_id: id.trim().toUpperCase(), otp: otp.trim() } });
      await muat();
      toast('Verifikasi berhasil. Status pendaftaran ditampilkan.');
    } catch { setErr('Tracking ID atau Kode OTP tidak valid.'); }
    finally { setBusy(false); }
  };

  const keluar = async () => {
    try { await api('/public/tracking/keluar', { method: 'POST' }); } catch { /* abaikan */ }
    setData(null); setId(''); setOtp(''); setChannel('email'); setOtpTerkirim(false); setTeks({}); setBerkas({});
    toast('Sesi tracking ditutup');
  };

  const salin = async (v: string, label: string) => {
    try { await navigator.clipboard.writeText(v); toast(`${label} disalin`); }
    catch { toast('Gagal menyalin. Pilih teks lalu salin manual.', false); }
  };

  const unduhRingkasan = () => {
    const isi = [
      'SIDOMAS — RINGKASAN TRACKING PENDAFTARAN',
      '========================================',
      `Nama Ormas   : ${data.nama_ormas}`,
      `Tracking ID  : ${data.tracking_id}`,
      `Tanggal Daftar: ${fmtDate(data.tanggal_daftar)}`,
      `Status       : ${data.status_label}`,
      `Catatan Admin: ${data.catatan_admin || '-'}`,
      data.batas_revisi ? `Batas Revisi : ${fmtDate(data.batas_revisi)}` : '',
      '',
      'RIWAYAT STATUS',
      ...(data.riwayat || []).map((r: any) => `- ${fmtDate(r.created_at)} • ${r.label}${r.catatan ? ` (${r.catatan})` : ''}`),
      '',
      'ITEM PENDAFTARAN',
      ...(data.items || []).map((i: TrackingItem) => `- [${i.status}] ${i.label}: ${i.nilai || '-'}${i.catatan ? ` — ${i.catatan}` : ''}`),
    ].filter((x) => x !== undefined).join('\n');
    const a = document.createElement('a');
    const u = URL.createObjectURL(new Blob([isi], { type: 'text/plain;charset=utf-8' }));
    a.href = u; a.download = `tracking-${String(data.tracking_id || 'sidomas').replace(/[^A-Za-z0-9-]/g, '')}.txt`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
    toast('Ringkasan tracking diunduh');
  };

  const revisiItems: TrackingItem[] = (data?.items || []).filter((i: TrackingItem) => i.bisa_diedit);
  const kirimRevisi = async () => {
    if (!revisiItems.length) return;
    setBusy(true);
    try {
      const fd = new FormData();
      const perubahan: Record<string, string> = {};
      for (const it of revisiItems) {
        if (it.jenis === 'data') {
          const nilai = (teks[it.key] ?? it.nilai ?? '').trim();
          if (nilai !== String(it.nilai || '')) perubahan[it.key] = nilai;
        } else {
          const f = berkas[it.key];
          if (f) fd.append(it.jenis === 'logo' ? 'logo' : it.key.slice(4), f);
        }
      }
      if (!Object.keys(perubahan).length && !Array.from(fd.keys()).length) { toast('Belum ada perubahan yang diisi.', false); return; }
      fd.append('perubahan', JSON.stringify(perubahan));
      await api('/public/tracking/revisi', { method: 'PUT', form: fd });
      setTeks({}); setBerkas({});
      await muat();
      toast('Revisi terkirim. Pendaftaran kembali diperiksa admin.');
    } catch (x: any) { toast(x.message || 'Gagal mengirim revisi', false); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted">Memuat…
    <div><Link className="txt-link" to="/">Kembali ke beranda</Link></div>
  </div>;

  if (!data) return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
      <section className="pub-hero">
        <div className="photo kenburns -z-20" style={{ backgroundImage: "url('/bg-malioboro.jpg')" }} aria-hidden="true" />
        <div className="hero-chip"><span className="h-1.5 w-1.5 rounded-full bg-gold-soft" /> Layanan Publik · Bidang Poldagri</div>
        <h1 className="display mt-4 text-3xl text-white md:text-4xl">Tracking Pendaftaran</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-200">Pantau status pendaftaran ormas Anda dengan aman. Data hanya ditampilkan setelah verifikasi Tracking ID dan Kode OTP.</p>
      </section>
      <div className="pub-card-solid mx-auto mt-5 max-w-xl p-6 sm:p-8">
        <div className="mb-5 text-center"><ShieldCheck className="mx-auto text-gold" size={42} /><h1 className="mt-3 page-title">Verifikasi Tracking</h1>
          <p className="page-sub">Masukkan <b>Tracking ID</b>, lalu minta <b>Kode OTP</b> lewat <b>email</b> atau <b>WhatsApp</b> yang didaftarkan.</p></div>
        <form className="space-y-4" onSubmit={verifikasi}>
          <div><label className="lbl" htmlFor="trk-id">Tracking ID</label>
            <input id="trk-id" className="inp mono uppercase" autoComplete="off" placeholder="TRK-20260101-XXXXXXXX" value={id} onChange={(e) => { setId(e.target.value); setOtpTerkirim(false); }} maxLength={60} /></div>
          <div>
            <span className="lbl">Kirim Kode OTP ke</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" className={channel === 'email' ? 'btn-p' : 'btn-o'} onClick={() => { setChannel('email'); setOtpTerkirim(false); }}><Mail size={15} /> Email</button>
              <button type="button" className={channel === 'wa' ? 'btn-p' : 'btn-o'} onClick={() => { setChannel('wa'); setOtpTerkirim(false); }}><MessageCircle size={15} /> WhatsApp</button>
            </div>
            <button type="button" className="btn-o mt-2 w-full" disabled={busy} onClick={mintaOtp}>
              {channel === 'wa' ? <MessageCircle size={15} /> : <Mail size={15} />} {busy ? 'Mengirim…' : `Kirim OTP ke ${channel === 'wa' ? 'WhatsApp' : 'email'}`}
            </button>
          </div>
          <div><label className="lbl" htmlFor="trk-otp">Kode OTP (6 digit)</label>
            <input id="trk-otp" className="inp mono" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} />
            <p className="mt-1 text-xs text-muted">{otpTerkirim ? `OTP berlaku 10 menit. Cek ${channel === 'wa' ? 'pesan WhatsApp di nomor ketua ormas' : 'folder inbox/spam email ormas'}.` : `Klik "Kirim OTP ke ${channel === 'wa' ? 'WhatsApp' : 'email'}" lebih dulu.`}</p></div>
          {err && <div className="note-bad" role="alert">{err}</div>}
          <button className="btn-p w-full" disabled={busy} type="submit"><Search size={16} /> {busy ? 'Memverifikasi…' : 'Verifikasi & Lacak'}</button>
        </form>
        <p className="mt-4 text-xs text-muted">Tracking ID saja tidak membuka data. Beberapa percobaan OTP salah akan mengunci sementara verifikasi. OTP bisa dikirim ulang lewat email/WhatsApp; bila tidak diterima, hubungi admin.</p>
      </div>
      <div className="mt-5 text-center"><Link className="txt-link" to="/daftar">Daftar ormas baru</Link> · <Link className="txt-link" to="/">Beranda</Link></div>
    </div>
  );

  const sisa = hitung(data.batas_revisi);
  return (
    <div className="stagger mx-auto max-w-5xl space-y-4 px-4 py-6 md:py-8">
      <section className="pub-hero !py-7">
        <div className="photo kenburns -z-20" style={{ backgroundImage: "url('/bg-tugu.jpg')" }} aria-hidden="true" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><div className="hero-chip"><span className="h-1.5 w-1.5 rounded-full bg-gold-soft" /> Monitoring Pendaftaran</div>
            <h1 className="display mt-3 text-2xl text-white md:text-3xl">Tracking Pendaftaran</h1>
            <p className="mt-2 max-w-xl text-xs text-slate-200">Data hanya ditampilkan setelah verifikasi Tracking ID dan Kode OTP dari email/WhatsApp berhasil.</p></div>
          <div className="flex flex-wrap gap-2"><button className="btn-glass" onClick={unduhRingkasan}><Download size={15} /> Ringkasan</button><button className="btn-glass" onClick={keluar}><LogOut size={15} /> Keluar</button></div>
        </div>
      </section>

      <div className="pub-card-solid space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-bold text-ink">{data.nama_ormas}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted"><span className="mono">Tracking ID: <b className="text-ink">{data.tracking_id}</b></span>
              <button className="icon-btn" aria-label="Salin Tracking ID" onClick={() => salin(data.tracking_id, 'Tracking ID')}><Copy size={14} /></button>
              <span>Daftar {fmtDate(data.tanggal_daftar)}</span></div></div>
          <span className={`chip chip-dot ${warnaStatus(data.status)}`}>{data.status_label}</span>
        </div>
        <div><div className="mb-1 flex justify-between text-xs text-muted"><span>Progres pemeriksaan</span><span>{data.progress}%</span></div>
          <div className="work-track !h-2.5" role="progressbar" aria-valuenow={data.progress} aria-valuemin={0} aria-valuemax={100}><div className="work-fill" style={{ width: `${Math.max(0, Math.min(100, data.progress))}%` }} /></div></div>
        {data.catatan_admin && <div className="note-warn"><b>Catatan admin:</b> {data.catatan_admin}</div>}
        {data.status === 'dikembalikan' && data.batas_revisi && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-3 text-sm"><p className="text-muted">Tanggal dikembalikan</p><p className="font-semibold text-ink">{fmtDate(data.tanggal_dikembalikan)}</p></div>
            <div className="rounded-xl border border-line p-3 text-sm"><p className="text-muted">Batas akhir revisi (30 hari)</p><p className="font-semibold text-ink">{fmtDate(data.batas_revisi)}</p>
              <p className={`mono mt-1 font-bold ${sisa?.habis ? 'text-bad' : 'text-gold'}`}>{sisa?.teks || '-'}</p></div>
          </div>
        )}
        {data.status === 'hangus' && <div className="note-bad">Masa revisi 30 hari sudah berakhir. Form revisi ditutup. Admin masih dapat membaca data dan riwayat, serta memberi izin khusus pengajuan ulang.</div>}
        {data.status === 'disetujui' && <div className="note-info">Pendaftaran disetujui. Data dan dokumen sudah dipindahkan ke katalog ormas.</div>}
      </div>

      <div className="pub-card p-5">
        <h2 className="card-title">Riwayat status</h2>
        <ol className="mt-3 space-y-3 border-l border-line pl-4">
          {(data.riwayat || []).map((r: any, i: number) => (
            <li key={i} className="relative text-sm"><span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-gold" />
              <p className="font-semibold text-ink">{r.label}</p><p className="text-xs text-muted">{fmtDate(r.created_at)} · {r.oleh}</p>
              {r.catatan && <p className="mt-1 rounded-lg bg-soft p-2 text-xs">{r.catatan}</p>}</li>
          ))}
        </ol>
      </div>

      <div className="pub-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="card-title">Data & dokumen yang dikirim</h2><span className="text-xs text-muted">{data.items?.length || 0} item</span></div>
        <p className="mt-1 text-xs text-muted">Hijau = terverifikasi & terkunci · Merah = perlu revisi · Kuning = belum diperiksa (tidak dianggap terverifikasi).</p>
        <div className="mt-4 grid gap-2 xl:grid-cols-2">
          {(data.items || []).map((it: TrackingItem) => {
            const Icon = it.status === 'terverifikasi' ? CheckCircle2 : it.status === 'revisi' ? XCircle : Clock3;
            const warna = it.status === 'terverifikasi' ? 'text-ok' : it.status === 'revisi' ? 'text-bad' : 'text-warn';
            const inputKey = it.key;
            return (
              <div key={it.key} className={`rounded-xl border p-3 ${it.status === 'revisi' ? '!border-bad/50' : ''}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <Icon className={`mt-0.5 shrink-0 ${warna}`} size={18} />
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink">{it.label}</p>
                    <p className="break-words text-sm text-muted">{it.jenis === 'dokumen' ? (it.nilai || 'Belum diunggah') : it.jenis === 'logo' ? (it.nilai || 'Tidak ada logo') : (it.nilai || '-')}
                      {it.jenis === 'dokumen' && it.ukuran ? ` · ${fmtSize(it.ukuran)}` : ''}</p></div>
                  <div className="flex flex-wrap items-center gap-2">
                    {it.status === 'terverifikasi' && <span className="chip text-ok"><LockKeyhole size={12} /> Terverifikasi</span>}
                    {it.status === 'revisi' && <span className="chip text-bad">Perlu revisi</span>}
                    {it.status === 'pending' && <span className="chip text-warn">Belum diperiksa</span>}
                    {it.url && <a className="btn-o py-1 text-xs" href={`${it.url}?dl=1`}><FileText size={13} /> Unduh</a>}
                  </div>
                </div>
                {it.status === 'revisi' && it.catatan && <p className="note-bad mt-2 !py-2 text-xs"><b>Catatan admin:</b> {it.catatan}</p>}
                {it.bisa_diedit && (
                  <div className="mt-3 border-t border-line pt-3">
                    {it.jenis === 'data' ? (
                      <div><label className="lbl" htmlFor={'rev-' + it.key}>Perbaiki {it.label}</label>
                        <input id={'rev-' + it.key} className="inp" maxLength={5000} value={teks[inputKey] ?? it.nilai ?? ''} onChange={(e) => setTeks((s) => ({ ...s, [inputKey]: e.target.value }))} /></div>
                    ) : (
                      <div><label className="lbl" htmlFor={'rev-' + it.key}>Unggah ulang {it.label}</label>
                        <input id={'rev-' + it.key} className="inp" type="file" accept={it.jenis === 'logo' ? 'image/png,image/jpeg' : docAccept(it.key.slice(4))} onChange={(e) => setBerkas((s) => ({ ...s, [inputKey]: e.target.files?.[0] || null }))} />
                        {berkas[inputKey] && <p className="mt-1 text-xs text-ok">Berkas baru dipilih: {berkas[inputKey]!.name}</p>}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {data.bisa_revisi && revisiItems.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <p className="text-xs text-muted">Item terverifikasi tetap terkunci. Hanya item berstatus <b>perlu revisi</b> yang dikirim ulang.</p>
            <button className="btn-p" disabled={busy} onClick={kirimRevisi}><Send size={15} /> {busy ? 'Mengirim…' : 'Kirim revisi ke admin'}</button>
          </div>
        )}
        {data.status === 'hangus' && <div className="mt-4 note-bad">Form revisi ditutup. Hubungi admin bila memerlukan izin khusus.</div>}
      </div>
      <div className="text-center"><Link className="txt-link" to="/katalog">Lihat katalog ormas</Link></div>
    </div>
  );
}
