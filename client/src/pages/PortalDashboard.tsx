import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Bell, BookOpen, Building2, CheckCheck, ClipboardList, Info, Megaphone, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { Badge, DokumenStatusBadge, Empty, ErrorBox, LaporanBadge, LegalBadge, Loading, NotifKategoriBadge, Skeleton, fmtDate, labelLaporan, useFetch, useToast } from '../ui';
import { ChangePassword } from './AdminAuth';
import { PortalHeader, usePortalAuth } from './Portal';

const QUICK: [string, string, any, string][] = [
  ['/portal/data#sec-company-profile', 'Company Profile', BookOpen, 'Langsung ke bagian unggah Company Profile'],
  ['/portal/laporan', 'Laporan Kegiatan Tahunan', ClipboardList, 'Unggah PDF per tahun dan lihat arsipnya'],
];

const notifTujuan = (n: any) => {
  if (['laporan', 'revisi'].includes(n.jenis)) return '/portal/laporan';
  if (n.jenis === 'legal') return '/portal/data#sec-legal';
  if (n.jenis === 'kedaluwarsa') return '/portal/data#sec-skto';
  if (n.jenis === 'catatan_admin') return '/portal/data';
  return '/portal/dashboard';
};

const Kartu = ({ label, value, catatan, tone = 'text-gold', icon: Icon }: any) => (
  <div className="card relative min-w-0 overflow-hidden p-4">
    <span aria-hidden="true" className={`pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-current opacity-[.08] blur-2xl ${tone}`} />
    <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-muted">{label}</p><Icon size={17} className={tone} /></div>
    <p className="mt-3 text-2xl font-extrabold leading-none text-ink">{value}</p>
    {catatan && <p className="mt-2 text-[11px] leading-snug text-muted">{catatan}</p>}
  </div>
);

const Panel = ({ title, action, children, className = '' }: any) => <section className={`card min-w-0 p-5 ${className}`}><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="card-title">{title}</h2>{action}</div>{children}</section>;

export function PortalDashboard() {
  const nav = useNavigate(); const toast = useToast();
  const { me, err, load } = usePortalAuth();
  const { data: d, loading, error, reload } = useFetch<any>('/portal/dashboard');

  if (err) return <div className="p-6"><ErrorBox text={err} retry={load} /></div>;
  if (!me) return <Loading />;
  if (me.must_change) return <ChangePassword path="/portal/change-password" onDone={load} />;

  const readAll = async () => { try { await api('/portal/notifikasi/read-all', { method: 'POST', body: {} }); toast('Semua notifikasi ditandai sudah dibaca'); reload(); } catch (e: any) { toast(e.message, false); } };
  const readOne = async (n: any) => { if (!n.dibaca) { try { await api(`/portal/notifikasi/${n.id}/read`, { method: 'POST', body: {} }); reload(); } catch { /* abaikan */ } } nav(notifTujuan(n)); };

  return (
    <div className="min-h-screen">
      <PortalHeader />
      <main className="stagger mx-auto max-w-6xl space-y-4 px-3 py-5 sm:px-4">
        {!!d?.pengumuman?.length && <section className="card-solid relative overflow-hidden !rounded-3xl border-gold/50 p-5 md:p-6" aria-label="Pengumuman SIDOMAS">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold via-navy to-transparent" />
          <div className="mb-3 flex flex-wrap items-center gap-2"><Megaphone size={18} className="text-gold" /><h2 className="text-base font-extrabold text-ink">Pengumuman SIDOMAS</h2><span className="chip text-gold">{d.pengumuman.length} pengumuman aktif</span></div>
          <ul className="grid gap-3 md:grid-cols-2">{d.pengumuman.map((p: any) => <li key={p.id} className="panel !bg-surface/60">
            <div className="flex flex-wrap items-center gap-2"><b className="text-sm text-ink [overflow-wrap:anywhere]">{p.judul}</b><NotifKategoriBadge kategori={p.kategori} /></div>
            <p className="mt-1 text-xs text-muted [overflow-wrap:anywhere]">{p.pesan}</p>
            <p className="mt-1 text-[10px] text-muted/80">{fmtDate(p.created_at)}</p>
          </li>)}</ul>
        </section>}

        {d?.laporan?.pengingat && <section className="card-solid !rounded-3xl border-bad/40 p-5" aria-label="Pengingat laporan tahunan">
          <div className="flex flex-wrap items-center gap-2"><AlertTriangle size={18} className="text-warn" /><h2 className="text-base font-extrabold text-ink">Pengingat Laporan Kegiatan Tahunan {d.laporan.tahun}</h2><LaporanBadge status={d.laporan.status} /></div>
          <p className="mt-2 whitespace-pre-line text-xs text-muted">{d.laporan.pengingat.pesan}</p>
          <Link className="btn-p mt-3" to={d.laporan.link}>Buka halaman laporan <ArrowRight size={14} /></Link>
        </section>}

        <section className="card relative overflow-hidden !rounded-3xl p-5 md:p-7">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-navy via-gold to-transparent" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">{d?.kode_ormas || me.kode_ormas} · Dashboard Ormas</p>
              <h1 className="page-title mt-2">{d?.nama_ormas || me.nama_ormas}</h1>
              <p className="page-sub">Pusat informasi dan monitoring data, dokumen, serta kewajiban laporan ormas Anda.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {d?.profil && <Badge s={d.profil.status_dokumen} />}
                <span className="chip-n">{d?.profil?.status_operasional || me.status_operasional}</span>
                <span className="chip-n">{d?.profil?.status_publikasi || me.status_publikasi}</span>
                {d?.profil?.menunggu_verifikasi && <span className="chip chip-dot text-info">Menunggu verifikasi admin</span>}
              </div>
            </div>
            <div className="panel min-w-[13rem] text-xs">
              <p className="font-semibold text-ink">Kelengkapan profil</p>
              <p className="mt-1 text-2xl font-extrabold text-ink">{d?.profil?.lengkap ?? 0}<span className="text-sm font-medium text-muted"> / {d?.profil?.total ?? 6}</span></p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${((d?.profil?.lengkap ?? 0) / (d?.profil?.total || 6)) * 100}%` }} /></div>
              <Link className="txt-link mt-2 inline-flex items-center gap-1" to="/portal/data">Lengkapi data <ArrowRight size={12} /></Link>
            </div>
          </div>
        </section>

        {error ? <ErrorBox text={error} retry={reload} /> : loading && !d ? <Skeleton rows={8} /> : d && (
          <>
            <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kartu label="Status profil" value={d.profil.status_dokumen} catatan={`Diperbarui ${fmtDate(d.profil.updated_at)}`} icon={Building2} />
              <Kartu label="Company Profile" value={d.company_profile.status} catatan={`${d.company_profile.terisi}/${d.company_profile.total} bagian terisi`} tone={d.company_profile.status === 'Lengkap' ? 'text-ok' : 'text-warn'} icon={BookOpen} />
              <Kartu label="Legal Standing" value={{ ya: 'Sudah memiliki', tidak: 'Tidak memiliki', '': 'Belum dijawab' }[d.legal.status] || 'Belum dijawab'} catatan={d.legal.jenis || 'Belum ada dokumen legal'} tone={d.legal.status === 'ya' ? 'text-ok' : 'text-warn'} icon={ShieldCheck} />
              <Kartu label="Laporan Tahunan" value={labelLaporan(d.laporan.status)} catatan={`Tahun ${d.laporan.tahun} · ${d.laporan.kelengkapan ?? 0}% lengkap · ${d.laporan.arsip} arsip`} tone={d.laporan.status === 'selesai' ? 'text-ok' : d.laporan.status === 'dikirim' ? 'text-info' : 'text-warn'} icon={ClipboardList} />
            </div>

            <section className="card p-4" aria-label="Akses cepat pengelolaan data">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="card-title">Akses cepat pengelolaan data</h2><span className="text-xs text-muted">Hanya dua pintasan utama</span></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {QUICK.map(([to, label, Icon, desc]) => <Link key={label} to={to} className="card-solid card-lift group flex min-w-0 items-start gap-3 p-4 text-sm">
                  <span className="brand-mark h-10 w-10 !rounded-xl"><Icon size={17} /></span>
                  <span className="min-w-0"><b className="block text-ink">{label}</b><span className="mt-0.5 block text-[11px] leading-snug text-muted">{desc}</span></span>
                  <ArrowRight size={15} className="ml-auto mt-1 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-gold" />
                </Link>)}
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Monitoring masa berlaku dokumen" className="xl:col-span-2" action={<Link className="txt-link text-xs" to="/portal/data#sec-dokumen">Kelola dokumen</Link>}>
                <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
                  {[['Aktif', d.ringkasan_dokumen.aktif, 'text-ok'], ['Akan Berakhir', d.ringkasan_dokumen.akan_berakhir, 'text-warn'], ['Segera Diperbarui', d.ringkasan_dokumen.segera_diperbarui, 'text-warn'], ['Kedaluwarsa', d.ringkasan_dokumen.kedaluwarsa, 'text-bad'], ['Belum Memiliki Data', d.ringkasan_dokumen.belum, 'text-muted']].map(([l, n, tone]) => <span key={l} className={`chip ${tone}`}>{l}: <b>{n}</b></span>)}
                </div>
                <div className="card-solid overflow-x-auto">
                  <table className="tbl tbl-dense"><thead><tr>{['Dokumen', 'Berlaku', 'Berakhir', 'Status', 'Keterangan', 'Aksi'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
                    <tbody>{d.dokumen.map((x: any) => <tr key={x.kode}>
                      <td data-label="Dokumen" className="td font-semibold">{x.nama}{x.opsional && <span className="ml-1 text-xs font-normal text-muted">(opsional)</span>}</td>
                      <td data-label="Berlaku" className="td text-xs">{x.tanggal_berlaku || '-'}</td>
                      <td data-label="Berakhir" className="td text-xs">{x.tanggal_berakhir || '-'}{x.hari != null && <span className={`block text-[10px] ${x.hari < 0 ? 'text-bad' : 'text-muted'}`}>{x.hari < 0 ? `lewat ${-x.hari} hari` : `${x.hari} hari lagi`}</span>}</td>
                      <td data-label="Status" className="td"><DokumenStatusBadge status={x.status} /></td>
                      <td data-label="Keterangan" className="td max-w-[16rem] text-xs text-muted">{x.keterangan || '-'}</td>
                      <td data-label="Aksi" className="td"><Link className="txt-link whitespace-nowrap text-xs" to={x.link}>Perbarui</Link></td>
                    </tr>)}</tbody></table>
                </div>
              </Panel>
              <div className="space-y-4">
                <Panel title="Dokumen akan habis" action={d.akan_habis.length ? <AlertTriangle size={16} className="text-warn" /> : undefined}>
                  {d.akan_habis.length ? <ul className="divide-y divide-line text-sm">{d.akan_habis.map((x: any) => <li key={x.kode} className="py-2 first:pt-0"><Link className="font-semibold text-ink hover:text-link" to={x.link}>{x.nama}</Link><p className="text-xs text-muted">{x.status} · {x.tanggal_berakhir || 'tanggal belum terbaca'}</p></li>)}</ul> : <Empty text="Tidak ada dokumen yang akan habis." />}
                </Panel>
                <Panel title="Data yang perlu diperbarui">
                  {d.perlu_diperbarui.length ? <ul className="space-y-2 text-sm">{d.perlu_diperbarui.slice(0, 10).map((x: any, i: number) => <li key={i} className="flex items-start gap-2"><Info size={14} className="mt-0.5 shrink-0 text-warn" /><Link className="text-link hover:underline" to={x.link}>{x.label}</Link></li>)}</ul> : <Empty text="Semua data sudah lengkap." />}
                </Panel>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Notifikasi" action={<button className="btn-o py-1 text-xs" disabled={!d.notifikasi.unread} onClick={readAll}><CheckCheck size={14} /> Tandai dibaca{` (${d.notifikasi.unread})`}</button>}>
                {d.notifikasi.items.length ? <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto">{d.notifikasi.items.map((n: any) => (
                  <li key={n.id}><button className={`flex w-full items-start gap-2 px-1 py-2.5 text-left hover:bg-soft/50 ${n.dibaca ? '' : 'bg-info/10'}`} onClick={() => readOne(n)}>
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.dibaca ? 'bg-soft' : 'bg-bad'}`} />
                    <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><b className="text-sm text-ink [overflow-wrap:anywhere]">{n.judul}</b><NotifKategoriBadge kategori={n.kategori} /></span><span className="mt-0.5 block text-xs text-muted [overflow-wrap:anywhere]">{n.pesan}</span><span className="mt-0.5 block text-[10px] text-muted/80">{fmtDate(n.created_at)}</span></span>
                  </button></li>))}</ul> : <Empty text="Belum ada notifikasi." />}
              </Panel>
              <div className="space-y-4">
                <Panel title="Catatan Admin" action={<Bell size={16} className="text-info" />}>
                  {d.catatan_admin.length ? <ul className="divide-y divide-line text-sm">{d.catatan_admin.map((c: any, i: number) => <li key={i} className="py-2 first:pt-0"><p><b className="text-ink">{c.jenis}:</b> <span className="[overflow-wrap:anywhere]">{c.teks}</span></p>{c.link && <Link className="txt-link text-xs" to={c.link}>Buka terkait</Link>}</li>)}</ul> : <Empty text="Tidak ada catatan dari admin." />}
                </Panel>
                <Panel title="Laporan Kegiatan Tahunan">
                  <div className="flex flex-wrap items-center gap-2 text-sm"><LaporanBadge status={d.laporan.status} /><span className="text-muted">Tahun {d.laporan.tahun}{d.laporan.dikirim_at ? ` · dikirim ${fmtDate(d.laporan.dikirim_at)}` : ''}</span></div>
                  <div className="mt-2 text-xs text-muted">Kelengkapan {d.laporan.kelengkapan ?? 0}% ({d.laporan.lengkap ?? 0}/{d.laporan.total ?? 2} indikator)</div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${d.laporan.kelengkapan ?? 0}%` }} /></div>
                  {d.laporan.pengingat && <div className="note-warn mt-3 !text-xs"><b>Pengingat Laporan Kegiatan Tahunan.</b> {d.laporan.pengingat.pesan.split('\n\n')[1]}</div>}
                  {d.laporan.tahun_lalu_belum && <p className="mt-2 flex items-center gap-1 text-xs text-bad"><AlertTriangle size={13} /> Laporan tahun {d.laporan.tahun_lalu_belum} belum dikirim.</p>}
                  <Link className="btn-p mt-4" to="/portal/laporan">Kelola laporan <ArrowRight size={15} /></Link>
                </Panel>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
