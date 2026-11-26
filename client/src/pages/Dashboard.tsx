import React from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, ArrowUpRight, BadgeCheck, Building2, CalendarClock, CalendarX2, Download, FileWarning, Plus, ShieldQuestion, UserPlus } from 'lucide-react';
import { CountUp, LiveClock } from '../fx';
import { Badge, Empty, ErrorBox, STATUS_COLOR, fmtDate, tglIndo, useFetch } from '../ui';
import { useAuth } from './Admin';

const WIB = 'Asia/Jakarta';
const salam = () => { const h = +new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: WIB }).format(new Date()); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; };

const Tip = ({ active, payload }: any) => !active || !payload?.length ? null : (
  <div className="chart-tip"><p className="font-semibold text-ink">{payload[0].payload.name}</p><p className="text-muted">{Number(payload[0].value).toLocaleString('id-ID')} ormas</p></div>
);

function Stat({ label, value, icon: Icon, to, tone = 'text-gold', delay }: any) {
  return (
    <Link to={to} className="card card-lift sheen group relative flex min-h-[8.5rem] flex-col justify-between overflow-hidden p-4" style={{ animationDelay: `${delay + 80}ms` }}>
      <span aria-hidden="true" className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-current opacity-[.09] blur-2xl transition duration-500 group-hover:scale-150 group-hover:opacity-20 ${tone}`} />
      <div className="flex items-start justify-between gap-2"><Icon size={18} strokeWidth={1.7} className={`stat-icon ${tone}`} /><ArrowUpRight size={15} className="text-muted opacity-0 transition group-hover:opacity-100" /></div>
      <div><p className="text-[34px] font-extrabold leading-none tracking-tight text-ink"><CountUp value={value} duration={900} /></p><p className="mt-2 text-xs font-medium leading-snug text-muted">{label}</p></div>
    </Link>
  );
}

const Panel = ({ title, action, children, className = '' }: any) => (
  <section className={`card min-w-0 p-5 ${className}`}><div className="mb-4 flex items-center justify-between gap-3"><h2 className="card-title">{title}</h2>{action}</div>{children}</section>
);
const More = ({ to, children = 'Lihat semua' }: any) => <Link to={to} className="txt-link inline-flex items-center gap-1 text-xs">{children} <ArrowRight size={13} /></Link>;

export function Dashboard() {
  const me = useAuth(); const { data: d, loading, error, reload } = useFetch<any>('/admin/dashboard');
  const can = (p: string) => me.perms.includes(p);
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (loading || !d) return (
    <div className="space-y-4" role="status" aria-label="Memuat dashboard"><div className="skel h-36 !rounded-3xl" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skel h-36 !rounded-2xl" />)}</div></div>
  );
  const s = d.stats; const exp = d.dok_kedaluwarsa;
  const status = d.by_status.filter((x: any) => x.value > 0);
  const total = d.by_status.reduce((a: number, x: any) => a + x.value, 0);
  return (
    <div className="stagger space-y-4">
      {/* Sambutan */}
      <section className="card relative overflow-hidden !rounded-3xl p-5 md:p-7">
        <div aria-hidden="true" className="photo kenburns opacity-[.16]" style={{ backgroundImage: "url('/bg-tugu.jpg')", backgroundPosition: 'center 62%', WebkitMaskImage: 'linear-gradient(90deg, transparent 30%, #000)', maskImage: 'linear-gradient(90deg, transparent 30%, #000)' }} />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="eyebrow">{new Date().toLocaleDateString('id-ID', { timeZone: WIB, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <h1 className="page-title mt-2">{salam()}, {me.nama}</h1>
            <p className="page-sub">Ringkasan data organisasi kemasyarakatan dan kelengkapan dokumennya.</p>
            <p className="mt-3 text-xs text-muted">Data terakhir diperbarui: {fmtDate(d.last_update)}</p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
          <LiveClock />
          <div className="flex flex-wrap gap-2">
            {can('manage_ormas') && <Link to="/admin/ormas?tambah=1" className="btn-p"><Plus size={16} /> Tambah Ormas</Link>}
            <Link to="/admin/pendaftaran" className="btn-o"><UserPlus size={16} /> Tindak lanjuti</Link>
            {can('export') && <Link to="/admin/ekspor" className="btn-o"><Download size={16} /> Ekspor</Link>}
          </div>
          </div>
        </div>
      </section>

      {/* Statistik: dua angka utama + status yang perlu perhatian */}
      <div className="stagger stagger-pop grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat delay={0} label="Ormas Terdaftar" value={s.terdaftar} icon={Building2} to="/admin/ormas" />
        <Stat delay={40} label="Ormas Aktif" value={s.aktif} icon={BadgeCheck} to="/admin/ormas" tone="text-ok" />
        <Stat delay={80} label="Pendaftaran Baru (Tindak Lanjuti)" value={s.pendaftaran_baru} icon={UserPlus} to="/admin/pendaftaran" tone={s.pendaftaran_baru ? 'text-warn' : 'text-gold'} />
        <Stat delay={120} label="Perlu Diverifikasi" value={s.perlu_verifikasi} icon={ShieldQuestion} to="/admin/ormas" tone="text-info" />
        <Stat delay={160} label="Belum Melengkapi Dokumen" value={s.belum_lengkap} icon={FileWarning} to="/admin/ormas" tone="text-warn" />
        <Stat delay={200} label="Dokumen Sudah Kedaluwarsa" value={exp.sudah} icon={CalendarX2} to="/admin/kedaluwarsa" tone="text-bad" />
        <Stat delay={240} label="Dokumen Segera Berakhir (90 hari)" value={exp.segera} icon={CalendarClock} to="/admin/kedaluwarsa" tone="text-warn" />
        <Stat delay={280} label="Kategori yang memiliki ormas" value={d.by_kategori.length} icon={Building2} to="/admin/ormas" />
      </div>

      {/* Visualisasi */}
      <div className="stagger grid gap-4 xl:grid-cols-5">
        <Panel title="Ormas per kategori" className="xl:col-span-3">
          {d.by_kategori.length ? (
            <ResponsiveContainer width="100%" height={Math.max(220, d.by_kategori.length * 36)}>
              <BarChart data={d.by_kategori} layout="vertical" margin={{ left: 0, right: 16 }}>
                <defs><linearGradient id="barFill" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#C6A96B" stopOpacity={0.35} /><stop offset="100%" stopColor="#C6A96B" /></linearGradient></defs>
                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={130} axisLine={false} tickLine={false} tick={{ fontSize: 11.5 }} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="value" name="Jumlah" fill="url(#barFill)" radius={[0, 8, 8, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="Belum ada data" />}
        </Panel>
        <Panel title="Distribusi status dokumen" className="xl:col-span-2">
          {total ? (
            <div className="relative">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart><Pie data={status} dataKey="value" nameKey="name" innerRadius={72} outerRadius={96} paddingAngle={status.length > 1 ? 3 : 0} cornerRadius={5} stroke="none">{status.map((x: any) => <Cell key={x.name} fill={STATUS_COLOR[x.name]} />)}</Pie><Tooltip content={<Tip />} wrapperStyle={{ zIndex: 5 }} /></PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-content-center text-center"><span className="text-3xl font-extrabold text-ink">{total.toLocaleString('id-ID')}</span><span className="text-[11px] uppercase tracking-widest text-muted">ormas</span></div>
            </div>
          ) : <Empty text="Belum ada data" />}
          <ul className="mt-3 space-y-1.5 text-xs">{d.by_status.map((x: any) => <li key={x.name} className="flex items-center gap-2.5"><i className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[x.name] }} /><span className="flex-1 text-muted">{x.name}</span><b className="text-ink">{x.value}</b></li>)}</ul>
        </Panel>
      </div>

      {/* Aktivitas */}
      <div className="stagger grid gap-4 lg:grid-cols-3">
        <Panel title="Ormas terbaru" action={<More to="/admin/ormas" />}>
          {d.terbaru.length ? (
            <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[4px] before:top-2 before:w-px before:bg-gold/25">
              {d.terbaru.map((r: any) => (
                <li key={r.id} className="relative pl-6">
                  <span className="absolute left-0 top-1.5 h-[9px] w-[9px] rounded-full bg-gold ring-4 ring-gold/15" />
                  <Link to={`/admin/ormas?detail=${r.id}`} className="block text-sm font-semibold text-ink hover:text-link">{r.nama_ormas}</Link>
                  <p className="mt-0.5 text-xs text-muted">{r.kode_ormas} · {r.nama_kategori}</p>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] text-muted">{fmtDate(r.created_at)}</span><Badge s={r.status_dokumen} /></div>
                </li>))}
            </ol>
          ) : <Empty text="Belum ada data." />}
        </Panel>
        <Panel title="Perlu diverifikasi" action={<More to="/admin/ormas" />}>
          {d.perlu_verifikasi.length ? (
            <ul className="divide-y divide-line">{d.perlu_verifikasi.map((r: any) => (
              <li key={r.id} className="py-3 first:pt-0"><Link to={`/admin/ormas?detail=${r.id}`} className="block text-sm font-semibold text-ink hover:text-link">{r.nama_ormas}</Link><p className="mt-0.5 text-xs text-muted">{r.kode_ormas} · diperbarui {fmtDate(r.updated_at)}</p></li>))}</ul>
          ) : <Empty text="Tidak ada ormas yang perlu diverifikasi." />}
        </Panel>
        <Panel title="Dokumen kedaluwarsa / segera berakhir" action={<More to="/admin/kedaluwarsa" />}>
          {exp.items.length ? (
            <ul className="divide-y divide-line">{exp.items.map((i: any) => (
              <li key={i.id + i.jenis} className="py-3 first:pt-0">
                <Link to={`/admin/ormas?detail=${i.id}`} className="block text-sm font-semibold text-ink hover:text-link">{i.nama_ormas}</Link>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><span>{i.kode_ormas} · {i.jenis} · s/d {tglIndo(i.berlaku_sd)}</span><span className={`chip ${i.hari < 0 ? 'text-bad' : 'text-warn'}`}>{i.hari < 0 ? `lewat ${-i.hari} hari` : i.hari === 0 ? 'berakhir hari ini' : `${i.hari} hari lagi`}</span></div>
              </li>))}</ul>
          ) : <Empty text="Tidak ada dokumen yang kedaluwarsa atau segera berakhir." />}
        </Panel>
      </div>
    </div>
  );
}
