import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Building2, ChevronDown, ChevronUp, Copy, Download, ExternalLink, Eye, FileText, KeyRound, TriangleAlert, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { api } from '../api';
import { ANGGOTA_KEYS, BerlakuInput, Badge, Confirm, DOC_STATUS, DOC_TYPES, DOKUMENTASI, ExpBadge, InstagramIcon, KEMANTREN, LinkInputs, MemberInputs, VALIDASI, nf, rincian, tglIndo, Empty, ErrorBox, Modal, Pager, STATUS_COLOR, Skeleton, fmtDate, fmtSize, qs, useDebounced, useFetch, useToast } from '../ui';
import { useAuth } from './Admin';

export function Dashboard() {
  const { data: d, loading, error, reload } = useFetch<any>('/admin/dashboard');
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (loading || !d) return <Skeleton rows={8} />;
  const cards = [['Ormas Terdaftar', d.stats.terdaftar, 'border-navy-700'], ['Ormas Aktif', d.stats.aktif, 'border-green-600'], ['Belum Melengkapi Dokumen', d.stats.belum_lengkap, 'border-orange-500'], ['Perlu Diverifikasi', d.stats.perlu_verifikasi, 'border-blue-600'], ['Dokumen Sudah Kedaluwarsa', d.dok_kedaluwarsa.sudah, 'border-red-600'], ['Dokumen Segera Berakhir (90 hari)', d.dok_kedaluwarsa.segera, 'border-amber-500']];
  const List = ({ title, rows, empty }: any) => (
    <div className="card p-4"><h3 className="mb-2 font-serif font-bold text-navy-900">{title}</h3>{rows.length ? <ul className="divide-y divide-slate-100 text-sm">{rows.map((r: any) => <li key={r.id} className="flex justify-between gap-2 py-2"><span><b>{r.kode_ormas}</b> {r.nama_ormas}</span>{r.status_dokumen && <Badge s={r.status_dokumen} />}</li>)}</ul> : <p className="text-sm text-slate-500">{empty}</p>}</div>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2"><h1 className="font-serif text-2xl font-bold text-navy-900">Dashboard</h1><p className="text-xs text-slate-500">Data terakhir diperbarui: {fmtDate(d.last_update)}</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([l, v, c]: any) => <div key={l} className={`card border-l-4 p-4 ${c}`}><p className="text-sm text-slate-600">{l}</p><p className="font-serif text-4xl font-bold text-navy-900">{v}</p></div>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4"><h3 className="mb-2 font-serif font-bold text-navy-900">Ormas per kategori</h3>
          {d.by_kategori.length ? <ResponsiveContainer width="100%" height={Math.max(180, d.by_kategori.length * 34)}><BarChart data={d.by_kategori} layout="vertical" margin={{ left: 10 }}><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="value" name="Jumlah" fill="#143a7a" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer> : <Empty text="Belum ada data" />}</div>
        <div className="card p-4"><h3 className="mb-2 font-serif font-bold text-navy-900">Distribusi status dokumen</h3>
          <ResponsiveContainer width="100%" height={250}><PieChart><Pie data={d.by_status.filter((s: any) => s.value > 0)} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} label>{d.by_status.filter((s: any) => s.value > 0).map((s: any) => <Cell key={s.name} fill={STATUS_COLOR[s.name]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          <div className="flex flex-wrap gap-2 text-xs">{d.by_status.map((s: any) => <span key={s.name} className="flex items-center gap-1"><i className="h-3 w-3 rounded-sm" style={{ background: STATUS_COLOR[s.name] }} />{s.name} ({s.value})</span>)}</div></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <List title="Ormas terbaru" rows={d.terbaru} empty="Belum ada data." />
        <List title="Perlu diverifikasi" rows={d.perlu_verifikasi} empty="Tidak ada ormas yang perlu diverifikasi." />
        <div className="card p-4"><div className="mb-2 flex items-center justify-between"><h3 className="font-serif font-bold text-navy-900">Dokumen kedaluwarsa / segera berakhir</h3><Link className="text-xs font-semibold text-navy-700 underline" to="/admin/kedaluwarsa">Lihat semua</Link></div>
          {d.dok_kedaluwarsa.items.length ? <ul className="divide-y divide-slate-100 text-sm">{d.dok_kedaluwarsa.items.map((i: any) => <li key={i.id + i.jenis} className="py-2"><b>{i.kode_ormas}</b> {i.nama_ormas}<div className="text-xs text-slate-500">{i.jenis} · s/d {tglIndo(i.berlaku_sd)} · <span className={i.hari < 0 ? 'font-semibold text-red-700' : 'font-semibold text-amber-700'}>{i.hari < 0 ? `lewat ${-i.hari} hari` : i.hari === 0 ? 'berakhir hari ini' : `${i.hari} hari lagi`}</span></div></li>)}</ul> : <p className="text-sm text-slate-500">Tidak ada dokumen yang kedaluwarsa atau segera berakhir.</p>}</div>
      </div>
    </div>
  );
}

export function OrmasPage() {
  const me = useAuth(); const toast = useToast();
  const [q, setQ] = useState(''); const [kat, setKat] = useState(''); const [sd, setSd] = useState(''); const [sort, setSort] = useState('kode'); const [dir, setDir] = useState('asc'); const [page, setPage] = useState(1);
  const [form, setForm] = useState<any>(null); const [detail, setDetail] = useState<number | null>(null); const [del, setDel] = useState<any>(null); const [newAcc, setNewAcc] = useState<any>(null);
  const dq = useDebounced(q); useEffect(() => setPage(1), [dq, kat, sd]);
  const [sp, setSp] = useSearchParams();
  useEffect(() => { const d = +(sp.get('detail') || 0); if (d) { setDetail(d); setSp({}, { replace: true }); } }, [sp]);
  const { data: exp } = useFetch<any>('/admin/kedaluwarsa?hari=90');
  const { data: meta } = useFetch<any>('/public/meta');
  const query = qs({ q: dq, kategori_id: kat, status_dokumen: sd, sort, dir, page, pageSize: 10 });
  const { data, loading, error, reload } = useFetch<any>('/admin/ormas?' + query);
  const can = (p: string) => me.perms.includes(p);
  const th = (key: string, label: string) => <th className="th cursor-pointer select-none" onClick={() => { if (sort === key) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(key); setDir('asc'); } }}><span className="inline-flex items-center gap-1">{label}{sort === key && (dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</span></th>;
  const remove = async () => { try { await api(`/admin/ormas/${del.id}`, { method: 'DELETE' }); toast('Data ormas dihapus'); setDel(null); reload(); } catch (e: any) { toast(e.message, false); } };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="font-serif text-2xl font-bold text-navy-900">Data Ormas</h1>
        <div className="flex flex-wrap gap-2">{can('export') && <a className="btn-o" href={`/api/admin/export/ormas?${qs({ q: dq, kategori_id: kat, status_dokumen: sd })}`}><Download size={16} /> Ekspor Excel</a>}{can('manage_ormas') && <button className="btn-p" onClick={() => setForm({})}><Plus size={16} /> Tambah Ormas</button>}</div></div>
      {exp && (exp.sudah > 0 || exp.segera > 0) && <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><span className="flex items-center gap-2"><TriangleAlert size={18} className="shrink-0" /><span>{exp.sudah > 0 && <b>{exp.sudah} dokumen sudah kedaluwarsa. </b>}{exp.segera > 0 && <>{exp.segera} dokumen akan berakhir dalam 90 hari. </>}Perhatikan label pada kolom Masa Berlaku.</span></span><Link className="font-semibold underline" to="/admin/kedaluwarsa">Lihat daftar</Link></div>}
      <div className="card grid gap-3 p-3 md:grid-cols-4">
        <div className="relative md:col-span-2"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input className="inp pl-9" placeholder="Cari nama, ID, pengurus, atau nomor legal" aria-label="Cari" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="inp" aria-label="Kategori" value={kat} onChange={(e) => setKat(e.target.value)}><option value="">Semua kategori</option>{meta?.categories.map((c: any) => <option key={c.id} value={c.id}>{c.nama_kategori}</option>)}</select>
        <select className="inp" aria-label="Status dokumen" value={sd} onChange={(e) => setSd(e.target.value)}><option value="">Semua status dokumen</option>{DOC_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <div className="card overflow-x-auto">
        {error ? <div className="p-4"><ErrorBox text={error} retry={reload} /></div> : loading && !data ? <Skeleton /> : !data?.items.length ? <Empty text="Tidak ada data ormas yang cocok." /> : (
          <table className="w-full"><thead className="border-b bg-slate-50"><tr><th className="th">No</th><th className="th">Logo</th>{th('kode', 'ID Ormas')}{th('nama', 'Nama Lengkap Ormas')}{th('kategori', 'Kategori')}{th('ketua', 'Ketua / Sekretaris / Bendahara')}{th('sk', 'Legal Standing')}<th className="th">Masa Berlaku</th>{th('status', 'Status Dokumen')}<th className="th">Aksi</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{data.items.map((o: any, i: number) => (
              <tr key={o.id} className="hover:bg-slate-50"><td className="td">{(page - 1) * 10 + i + 1}</td>
                <td className="td">{o.has_logo ? <img src={`/api/logo/${o.kode_ormas}?v=${encodeURIComponent(o.updated_at)}`} className="h-9 w-9 rounded object-cover" alt="" /> : <span className="grid h-9 w-9 place-items-center rounded bg-navy-50 text-navy-700"><Building2 size={16} /></span>}</td>
                <td className="td font-semibold">{o.kode_ormas}</td><td className="td min-w-[220px]">{o.nama_ormas}<div className="text-xs text-slate-500">{o.status_operasional} · {o.status_publikasi === 'Publik' ? 'Tampil di katalog' : 'Disembunyikan'}</div></td><td className="td">{o.nama_kategori}</td><td className="td min-w-[180px] text-xs"><b>{o.nama_ketua || '-'}</b><br />{o.sekretaris || '-'}<br />{o.bendahara || '-'}<div className="mt-1 border-t border-slate-100 pt-1 text-slate-600">Anggota: <b>{nf(o.anggota_total)}</b>{o.anggota_total != null && rincian(o, true) && <span className="text-slate-500"> ({rincian(o, true)})</span>}</div></td><td className="td text-xs">{o.legal_jenis || '-'}<br />{o.nomor_sk || '-'}{o.legal_tahun ? ` / ${o.legal_tahun}` : ''}{o.validasi && <div className="mt-1"><span className="rounded bg-navy-50 px-1.5 py-0.5 font-semibold text-navy-700">{o.validasi}</span></div>}</td>
                <td className="td min-w-[170px] text-xs"><div><span className="text-slate-500">SKTO s/d</span> <b>{o.exp.skto.tgl ? tglIndo(o.exp.skto.tgl) : o.skto_berlaku_sd || '-'}</b><br /><ExpBadge e={o.exp.skto} /></div><div className="mt-1"><span className="text-slate-500">Legal s/d</span> <b>{o.exp.legal.tgl ? tglIndo(o.exp.legal.tgl) : o.legal_berlaku_sd || '-'}</b><br /><ExpBadge e={o.exp.legal} /></div></td>
                <td className="td"><Badge s={o.status_dokumen} /><div className="mt-1 text-xs text-slate-500">{o.jumlah_dok}/5 dokumen</div>{o.has_pending ? <div className="mt-1 text-xs font-semibold text-blue-700">Ada perubahan baru dari ormas</div> : null}</td>
                <td className="td"><div className="flex gap-1">
                  <button className="btn-o px-2 py-1" title="Lihat detail" aria-label="Lihat detail" onClick={() => setDetail(o.id)}><Eye size={15} /></button>
                  {can('manage_ormas') && <><button className="btn-o px-2 py-1" title="Edit" aria-label="Edit" onClick={() => (o.has_pending ? toast('Ormas ini punya perubahan yang menunggu verifikasi. Buka Detail untuk memverifikasi atau menolaknya sebelum mengedit.', false) : setForm(o))}><Pencil size={15} /></button><button className="btn-o px-2 py-1 text-red-600" title="Hapus" aria-label="Hapus" onClick={() => setDel(o)}><Trash2 size={15} /></button></>}
                </div></td></tr>))}</tbody></table>)}
      </div>
      {data && <Pager page={page} total={data.total} size={10} onPage={setPage} />}
      {form && <OrmasForm item={form} cats={meta?.categories || []} meta={meta} onClose={() => setForm(null)} onSaved={(r: any) => { setForm(null); reload(); if (r?.portal) setNewAcc({ ...r.portal, kode: r.kode }); }} />}
      {detail && <Detail id={detail} onClose={() => setDetail(null)} onChanged={reload} />}
      {newAcc && <PortalCredModal acc={newAcc} onClose={() => setNewAcc(null)} />}
      {del && <Confirm danger title="Hapus data ormas" text={`Hapus ${del.kode_ormas} (${del.nama_ormas}) beserta semua dokumen PDF-nya? Tindakan ini tidak dapat dibatalkan. ID Ormas tidak akan dipakai ulang.`} onYes={remove} onNo={() => setDel(null)} />}
    </div>
  );
}

const KEYS = ['nama_ormas', 'kategori_id', 'bentuk', 'bidang_kegiatan', 'kemantren', 'validasi', 'nama_ketua', 'sekretaris', 'bendahara', 'nomor_whatsapp_ketua', 'email_ormas', 'alamat', 'legal_jenis', 'nomor_sk', 'legal_tahun', 'legal_berlaku_sd', 'skto_nomor', 'skto_tahun', 'skto_berlaku_sd', 'status_dokumen', 'status_operasional', 'status_publikasi', 'catatan_verifikasi', ...ANGGOTA_KEYS, 'link_dokumentasi', 'link_instagram'];
const DEFAULTS: any = { status_dokumen: 'Belum Lengkap', status_operasional: 'Aktif', status_publikasi: 'Disembunyikan' };

function OrmasForm({ item, cats, meta, onClose, onSaved }: any) {
  const toast = useToast(); const edit = !!item.id; const maxMb = meta?.max_pdf_mb || 20;
  const [f, setF] = useState<any>(() => Object.fromEntries(KEYS.map((k) => [k, item[k] ?? DEFAULTS[k] ?? ''])));
  const [logo, setLogo] = useState<File | null>(null); const [rmLogo, setRmLogo] = useState(false);
  const [files, setFiles] = useState<Record<string, File>>({}); const [docs, setDocs] = useState<any[]>([]); const [busy, setBusy] = useState(false);
  useEffect(() => { if (edit) api(`/admin/ormas/${item.id}`).then((d) => setDocs(d.docs)).catch(() => {}); }, []);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const T = (k: string, label: string, o: any = {}) => (
    <div className={o.span ? 'md:col-span-2' : ''}><label className="lbl" htmlFor={k}>{label}</label><input id={k} type={o.type || 'text'} list={o.list} className="inp" placeholder={o.ph} maxLength={o.max} value={f[k]} onChange={(e) => set(k, e.target.value)} /></div>
  );
  const H = (t: string) => <h3 className="border-b border-slate-200 pb-1 pt-2 font-serif font-bold text-navy-900 md:col-span-2">{t}</h3>;
  const pick = (j: string, x?: File) => {
    if (!x) return;
    if (x.type !== 'application/pdf') return toast(`"${x.name}" bukan PDF`, false);
    if (x.size > maxMb * 1048576) return toast(`"${x.name}" melebihi ${maxMb} MB`, false);
    setFiles((p) => ({ ...p, [j]: x }));
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    if (!f.nama_ormas.trim()) return toast('Nama ormas wajib diisi', false);
    if (!f.kategori_id) return toast('Kategori wajib dipilih', false);
    const miss = DOC_TYPES.filter(([j]) => !files[j] && !docs.some((d) => d.jenis_dokumen === j));
    const tot = f.anggota_total === '' ? null : +f.anggota_total;
    if (tot == null && ['anggota_perempuan', 'anggota_lansia', 'anggota_disabilitas'].some((k) => f[k] !== '')) return toast('Isi juga jumlah total anggota', false);
    if (tot != null && ['anggota_perempuan', 'anggota_lansia', 'anggota_disabilitas'].some((k) => f[k] !== '' && +f[k] > tot)) return toast('Rincian anggota tidak boleh lebih besar dari jumlah total', false);
    if (!edit && miss.length) return toast('Dokumen PDF wajib diunggah: ' + miss.map((m) => m[1]).join(', '), false);
    setBusy(true);
    const fd = new FormData(); KEYS.forEach((k) => fd.append(k, String(f[k] ?? '')));
    Object.entries(files).forEach(([j, x]) => fd.append(j, x)); if (logo) fd.append('logo', logo); if (rmLogo) fd.append('remove_logo', '1');
    try { const r = await api(edit ? `/admin/ormas/${item.id}` : '/admin/ormas', { method: edit ? 'PUT' : 'POST', form: fd }); toast(edit ? 'Perubahan disimpan' : 'Ormas berhasil ditambahkan'); onSaved(r); }
    catch (x: any) { toast(x.message, false); setBusy(false); }
  };
  return (
    <Modal wide title={edit ? `Edit ${item.kode_ormas}` : 'Tambah Ormas'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        {H('Identitas Ormas')}
        <div><span className="lbl">ID Ormas</span><div className="rounded bg-slate-100 px-3 py-2 text-sm text-slate-600">{edit ? item.kode_ormas : 'Dibuat otomatis oleh sistem'}</div></div>
        <div><label className="lbl" htmlFor="lg">Logo ormas (opsional)</label><input id="lg" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => setLogo(e.target.files?.[0] || null)} />{edit && item.has_logo && !logo && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" checked={rmLogo} onChange={(e) => setRmLogo(e.target.checked)} />Hapus logo saat ini</label>}</div>
        {T('nama_ormas', 'Nama ormas *', { span: true, max: 200 })}
        <div><label className="lbl" htmlFor="kt">Bidang / kategori *</label><select id="kt" className="inp" value={f.kategori_id} onChange={(e) => set('kategori_id', e.target.value)}><option value="">Pilih kategori</option>{cats.filter((c: any) => c.status_aktif || c.id === item.kategori_id).map((c: any) => <option key={c.id} value={c.id}>{c.nama_kategori}</option>)}</select></div>
        {T('bentuk', 'Bentuk', { list: 'dl-bentuk', ph: 'Mis. Perkumpulan, Yayasan' })}
        {T('bidang_kegiatan', 'Bidang kegiatan', { span: true, max: 300 })}
        <div><label className="lbl" htmlFor="validasi">Status validasi</label><select id="validasi" className="inp" value={f.validasi} onChange={(e) => set('validasi', e.target.value)}><option value="">Pilih status</option>{VALIDASI.map((v) => <option key={v}>{v}</option>)}</select></div>
        <div><label className="lbl" htmlFor="km">Kemantren</label><select id="km" className="inp" value={f.kemantren} onChange={(e) => set('kemantren', e.target.value)}><option value="">Pilih kemantren</option>{KEMANTREN.map((k) => <option key={k}>{k}</option>)}</select></div>
        <datalist id="dl-bentuk"><option value="Perkumpulan" /><option value="Yayasan" /><option value="Organisasi tanpa badan hukum" /></datalist>
        {H('Nama Pengurus')}
        {T('nama_ketua', 'Ketua')}{T('sekretaris', 'Sekretaris')}{T('bendahara', 'Bendahara')}
        {T('nomor_whatsapp_ketua', 'Nomor telepon / WhatsApp ketua', { type: 'tel', ph: '081234567890' })}
        {H('Kontak dan Alamat')}
        {T('email_ormas', 'Email ormas', { type: 'email', ph: 'nama@contoh.id' })}
        <div className="md:col-span-2"><label className="lbl" htmlFor="al">Alamat kantor / sekretariat <span className="font-normal text-slate-500">(tulis selengkap mungkin, dipakai untuk peta di halaman publik)</span></label><textarea id="al" rows={2} maxLength={500} className="inp" value={f.alamat} onChange={(e) => set('alamat', e.target.value)} /></div>
        {H('Jumlah Anggota')}
        <MemberInputs f={f} set={set} />
        {H('Legal Standing')}
        {T('legal_jenis', 'Jenis', { list: 'dl-legal', ph: 'Mis. Akta Notaris' })}{T('nomor_sk', 'Nomor')}{T('legal_tahun', 'Tahun', { ph: '2021', max: 4 })}<BerlakuInput id="legal_berlaku_sd" label="Berlaku s/d" forever value={f.legal_berlaku_sd} onChange={(v) => set('legal_berlaku_sd', v)} />
        <datalist id="dl-legal"><option value="Akta Notaris" /><option value="SK Kemenkumham" /></datalist>
        {H('SKTO')}
        {T('skto_nomor', 'Nomor')}{T('skto_tahun', 'Tahun', { ph: '2024', max: 4 })}<BerlakuInput id="skto_berlaku_sd" label="Berlaku s/d" value={f.skto_berlaku_sd} onChange={(v) => set('skto_berlaku_sd', v)} />
        {H('Status')}
        <div><label className="lbl" htmlFor="sd">Status dokumen</label><select id="sd" className="inp" value={f.status_dokumen} onChange={(e) => set('status_dokumen', e.target.value)}>{DOC_STATUS.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label className="lbl" htmlFor="so">Status operasional</label><select id="so" className="inp" value={f.status_operasional} onChange={(e) => set('status_operasional', e.target.value)}><option>Aktif</option><option>Tidak Aktif</option></select></div>
        <div><label className="lbl" htmlFor="sp">Status publikasi katalog</label><select id="sp" className="inp" value={f.status_publikasi} onChange={(e) => set('status_publikasi', e.target.value)}><option value="Publik">Publik (tampil di katalog)</option><option value="Disembunyikan">Disembunyikan</option></select></div>
        <div className="md:col-span-2"><label className="lbl" htmlFor="cv">Catatan verifikasi (opsional)</label><textarea id="cv" rows={2} className="inp" value={f.catatan_verifikasi} onChange={(e) => set('catatan_verifikasi', e.target.value)} /></div>
        {H(`Dokumen PDF wajib (maks. ${maxMb} MB per file)`)}
        <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
          {DOC_TYPES.map(([j, l]) => { const cur = docs.find((d) => d.jenis_dokumen === j); return (
            <div key={j} className={`rounded-md border p-3 ${files[j] || cur ? 'border-green-300 bg-green-50' : 'border-slate-200'}`}>
              <label className="lbl" htmlFor={'f_' + j}>{l} {!edit && '*'}</label>
              <input id={'f_' + j} type="file" accept="application/pdf" className="w-full text-xs" onChange={(e) => { pick(j, e.target.files?.[0]); e.target.value = ''; }} />
              <p className="mt-1 text-xs text-slate-600">{files[j] ? <>Akan diunggah: <b>{files[j].name}</b> ({fmtSize(files[j].size)}) <button type="button" className="text-red-600 underline" onClick={() => setFiles((p) => { const n = { ...p }; delete n[j]; return n; })}>batal</button></> : cur ? <>Tersimpan: {cur.nama_file} ({fmtSize(cur.ukuran_file)}). Pilih file baru untuk mengganti.</> : edit ? 'Belum diunggah' : 'Wajib diunggah'}</p>
            </div>); })}
        </div>
        {H('Dokumentasi Kegiatan dan Media Sosial (opsional)')}
        <LinkInputs f={f} set={set} />
        {(() => { const [j, l] = DOKUMENTASI; const cur = docs.find((d) => d.jenis_dokumen === j); return (
          <div className={`rounded-md border p-3 md:col-span-2 ${files[j] || cur ? 'border-green-300 bg-green-50' : 'border-slate-200'}`}>
            <label className="lbl" htmlFor="f_dok">Unggah {l} (PDF)</label>
            <input id="f_dok" type="file" accept="application/pdf" className="w-full text-xs" onChange={(e) => { pick(j, e.target.files?.[0]); e.target.value = ''; }} />
            <p className="mt-1 text-xs text-slate-600">{files[j] ? <>Akan diunggah: <b>{files[j].name}</b> ({fmtSize(files[j].size)}) <button type="button" className="text-red-600 underline" onClick={() => setFiles((p) => { const n = { ...p }; delete n[j]; return n; })}>batal</button></> : cur ? <>Tersimpan: {cur.nama_file} ({fmtSize(cur.ukuran_file)}). Pilih file baru untuk mengganti.</> : 'Tidak wajib. Kumpulkan foto kegiatan menjadi satu PDF, atau cukup pakai link di atas.'}</p>
          </div>); })()}
        <div className="flex justify-end gap-2 md:col-span-2"><button type="button" className="btn-o" onClick={onClose}>Batal</button><button className="btn-p" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
      </form>
    </Modal>
  );
}

function Detail({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const me = useAuth(); const { data: o, error, reload } = useFetch<any>(`/admin/ormas/${id}`); const [view, setView] = useState<any>(null); const [ask, setAsk] = useState(false); const [acc, setAcc] = useState<any>(null);
  const resetPortal = async () => { try { const r = await api(`/admin/ormas/${id}/portal-reset`, { method: 'POST', body: {} }); setAcc({ ...r, kode: o.kode_ormas }); setAsk(false); reload(); } catch (e: any) { alert(e.message); } };
  const row = (l: string, v: any) => <div className="min-w-0"><dt className="text-xs text-slate-500">{l}</dt><dd className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{v || '-'}</dd></div>;
  const lbl = (j: string) => DOC_TYPES.find(([k]) => k === j)?.[1] || 'Dokumen lain';
  const wa = (n: string) => n ? <a className="text-navy-700 underline" target="_blank" rel="noreferrer" href={`https://wa.me/${n.replace(/\D/g, '').replace(/^0/, '62')}`}>{n}</a> : '';
  return (
    <Modal wide title="Detail Ormas" onClose={onClose}>
      {error ? <ErrorBox text={error} /> : !o ? <Skeleton rows={4} /> : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">{o.has_logo ? <img src={`/api/logo/${o.kode_ormas}?v=${encodeURIComponent(o.updated_at)}`} className="h-16 w-16 rounded object-cover" alt="" /> : <span className="grid h-16 w-16 place-items-center rounded bg-navy-50 text-navy-700"><Building2 /></span>}<div><p className="text-sm text-slate-500">{o.kode_ormas}</p><h3 className="font-serif text-xl font-bold text-navy-900">{o.nama_ormas}</h3></div></div>
          {o.pending && <PendingPanel o={o} onDone={() => { reload(); onChanged(); }} />}
          <dl className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {row('Kategori', o.nama_kategori)}{row('Bentuk', o.bentuk)}{row('Kemantren', o.kemantren)}{row('Bidang kegiatan', o.bidang_kegiatan)}{row('Status validasi', o.validasi)}{row('Status dokumen', <Badge s={o.status_dokumen} />)}
            {row('Ketua', o.nama_ketua)}{row('Sekretaris', o.sekretaris)}{row('Bendahara', o.bendahara)}{row('Telepon / WhatsApp ketua', wa(o.nomor_whatsapp_ketua))}{row('Email ormas', o.email_ormas)}{row('Alamat kantor / sekretariat', o.alamat)}
            {row('Legal standing', <>{[o.legal_jenis, o.nomor_sk, o.legal_tahun && `Tahun ${o.legal_tahun}`, o.exp.legal.tgl ? `s/d ${tglIndo(o.exp.legal.tgl)}` : o.legal_berlaku_sd && `s/d ${o.legal_berlaku_sd}`].filter(Boolean).join(' · ') || '-'}<br /><ExpBadge e={o.exp.legal} full /></>)}{row('SKTO', <>{[o.skto_nomor, o.skto_tahun && `Tahun ${o.skto_tahun}`, o.exp.skto.tgl ? `s/d ${tglIndo(o.exp.skto.tgl)}` : o.skto_berlaku_sd && `s/d ${o.skto_berlaku_sd}`].filter(Boolean).join(' · ') || '-'}<br /><ExpBadge e={o.exp.skto} full /></>)}
            {row('Jumlah anggota', nf(o.anggota_total))}{row('Perempuan', nf(o.anggota_perempuan))}{row('Lansia', nf(o.anggota_lansia))}{row('Disabilitas', nf(o.anggota_disabilitas))}
            {row('Link dokumentasi', o.link_dokumentasi && <a className="text-navy-700 underline" target="_blank" rel="noreferrer" href={o.link_dokumentasi}>Buka tautan</a>)}{row('Instagram', o.link_instagram && <a className="inline-flex items-center gap-1 text-pink-600 underline" target="_blank" rel="noreferrer" href={o.link_instagram}><InstagramIcon size={14} />Buka Instagram</a>)}
            {row('Status operasional', o.status_operasional)}{row('Status publikasi', o.status_publikasi)}{row('Diperbarui', fmtDate(o.updated_at))}
          </dl>
          {o.catatan_verifikasi && <p className="rounded bg-slate-50 p-3 text-sm"><b>Catatan verifikasi:</b> {o.catatan_verifikasi}</p>}
          <div className="rounded border border-slate-200 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-semibold"><KeyRound size={14} className="mr-1 inline" />Akun portal ormas (untuk mengubah biodata)</h4><p className="text-xs text-slate-500">{o.portal ? <>Username: <b>{o.portal.username}</b> · login terakhir: {o.portal.last_login ? fmtDate(o.portal.last_login) : 'belum pernah'}{o.portal.must_change ? ' · password awal belum diganti ormas' : ''}</> : 'Belum dibuat'}</p></div>{me.perms.includes('manage_ormas') && <button className="btn-o py-1" onClick={() => setAsk(true)}>{o.portal ? 'Atur ulang password' : 'Buat akun'}</button>}</div></div>
          <div><h4 className="mb-2 font-semibold">Dokumen PDF</h4>
            <ul className="divide-y divide-slate-100 rounded border border-slate-200">{DOC_TYPES.map(([j, l]) => { const d = o.docs.find((x: any) => x.jenis_dokumen === j); return (
              <li key={j} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span><FileText size={14} className={`mr-1 inline ${d ? 'text-red-600' : 'text-slate-300'}`} /><b>{l}</b><span className="block text-xs text-slate-500">{d ? `${d.nama_file} · ${fmtSize(d.ukuran_file)} · ${fmtDate(d.uploaded_at)}` : 'Belum diunggah'}</span></span>
                {d && me.perms.includes('view_docs') && <span className="flex gap-2"><button className="btn-p py-1" onClick={() => setView(view?.id === d.id ? null : d)}><ExternalLink size={14} /> Buka PDF</button><a className="btn-o py-1" href={`/api/admin/files/${d.id}?dl=1`}><Download size={14} /> Download</a></span>}</li>); })}
              {(() => { const d = o.docs.find((x: any) => x.jenis_dokumen === 'dokumentasi'); return d ? <li className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span><FileText size={14} className="mr-1 inline text-red-600" /><b>Dokumentasi Kegiatan</b><span className="block text-xs text-slate-500">{d.nama_file} · {fmtSize(d.ukuran_file)} · {fmtDate(d.uploaded_at)}</span></span>{me.perms.includes('view_docs') && <span className="flex gap-2"><button className="btn-p py-1" onClick={() => setView(view?.id === d.id ? null : d)}><ExternalLink size={14} /> Buka PDF</button><a className="btn-o py-1" href={`/api/admin/files/${d.id}?dl=1`}><Download size={14} /> Download</a></span>}</li> : null; })()}
              {o.docs.filter((x: any) => !x.jenis_dokumen).map((d: any) => <li key={d.id} className="flex items-center justify-between p-3 text-sm"><span>{d.nama_file} <span className="text-xs text-slate-500">(dokumen lama)</span></span>{me.perms.includes('view_docs') && <a className="btn-o py-1" href={`/api/admin/files/${d.id}?dl=1`}><Download size={14} /></a>}</li>)}
            </ul></div>
          {view && <iframe title={view.nama_file} src={`/api/admin/files/${view.id}`} className="h-[60vh] w-full rounded border border-slate-300" />}
        </div>)}
      {ask && <Confirm title="Atur ulang password portal" text="Password portal ormas ini akan diganti dengan password baru. Password lama langsung tidak berlaku dan ormas diminta menggantinya saat login pertama. Lanjutkan?" onYes={resetPortal} onNo={() => setAsk(false)} />}
      {acc && <PortalCredModal acc={acc} onClose={() => setAcc(null)} />}
    </Modal>
  );
}

const FIELD_LABELS: [string, string][] = [['bentuk', 'Bentuk'], ['bidang_kegiatan', 'Bidang kegiatan'], ['kemantren', 'Kemantren'], ['nama_ketua', 'Ketua'], ['sekretaris', 'Sekretaris'], ['bendahara', 'Bendahara'], ['nomor_whatsapp_ketua', 'Telepon / WhatsApp ketua'], ['email_ormas', 'Email ormas'], ['alamat', 'Alamat kantor / sekretariat'], ['legal_jenis', 'Legal standing: jenis'], ['nomor_sk', 'Legal standing: nomor'], ['legal_tahun', 'Legal standing: tahun'], ['legal_berlaku_sd', 'Legal standing: berlaku s/d'], ['skto_nomor', 'SKTO: nomor'], ['skto_tahun', 'SKTO: tahun'], ['skto_berlaku_sd', 'SKTO: berlaku s/d'], ['anggota_total', 'Jumlah total anggota'], ['anggota_perempuan', 'Anggota perempuan'], ['anggota_lansia', 'Anggota lansia'], ['anggota_disabilitas', 'Anggota disabilitas'], ['link_dokumentasi', 'Link dokumentasi'], ['link_instagram', 'Instagram']];

// Perubahan dari portal ormas yang menunggu verifikasi. Selama belum diverifikasi, katalog publik dan Google Drive tetap memakai data lama.
function PendingPanel({ o, onDone }: { o: any; onDone: () => void }) {
  const me = useAuth(); const toast = useToast(); const p = o.pending;
  const [view, setView] = useState<any>(null); const [busy, setBusy] = useState(false); const [ask, setAsk] = useState(false); const [rej, setRej] = useState(false); const [note, setNote] = useState('');
  const diffs = FIELD_LABELS.filter(([k]) => String(p.data[k] ?? '') !== String(o[k] ?? ''));
  const lbl = (j: string) => [...DOC_TYPES, DOKUMENTASI].find(([k]) => k === j)?.[1] || 'Dokumen';
  const act = async (path: string, body: any, okMsg: string) => {
    if (busy) return; setBusy(true);
    try { await api(`/admin/ormas/${o.id}/${path}`, { method: 'POST', body }); toast(okMsg); onDone(); }
    catch (e: any) { toast(e.message, false); setBusy(false); setAsk(false); setRej(false); }
  };
  return (
    <div className="space-y-3 rounded border border-blue-200 bg-blue-50 p-3 text-sm">
      <div><h4 className="font-semibold text-blue-900">Perubahan dari ormas menunggu verifikasi</h4><p className="text-xs text-slate-600">Diajukan {fmtDate(p.updated_at)}. Data lain pada halaman ini dan katalog publik masih data lama sampai Anda memverifikasinya.</p></div>
      {diffs.length > 0 && <ul className="divide-y divide-blue-100 rounded border border-blue-100 bg-white">{diffs.map(([k, l]) => <li key={k} className="p-2 text-xs"><b className="block text-slate-700">{l}</b><span className="text-slate-500 line-through [overflow-wrap:anywhere]">{o[k] || '(kosong)'}</span> <span className="[overflow-wrap:anywhere]">→ <b>{p.data[k] || '(kosong)'}</b></span></li>)}</ul>}
      {p.logo === 'baru' && <div className="flex items-center gap-3 rounded border border-blue-100 bg-white p-2 text-xs"><img src={`/api/logo/${o.kode_ormas}?pending=1&v=${encodeURIComponent(p.updated_at)}`} alt="" className="h-12 w-12 rounded object-cover" /><b>Logo baru diunggah</b></div>}
      {p.logo === 'hapus' && <p className="rounded border border-blue-100 bg-white p-2 text-xs"><b>Logo ormas akan dihapus</b></p>}
      {p.docs.length > 0 && <ul className="divide-y divide-blue-100 rounded border border-blue-100 bg-white">{p.docs.map((d: any) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-2 text-xs"><span><FileText size={13} className="mr-1 inline text-red-600" /><b>{lbl(d.jenis_dokumen)}</b> (baru)<span className="block text-slate-500">{d.nama_file} · {fmtSize(d.ukuran_file)}</span></span>
          {me.perms.includes('view_docs') && <span className="flex gap-2"><button type="button" className="btn-p py-1" onClick={() => setView(view?.id === d.id ? null : d)}><ExternalLink size={13} /> Buka PDF</button><a className="btn-o py-1" href={`/api/admin/files/${d.id}?dl=1`}><Download size={13} /> Download</a></span>}</li>))}</ul>}
      {view && <iframe title={view.nama_file} src={`/api/admin/files/${view.id}`} className="h-[55vh] w-full rounded border border-slate-300 bg-white" />}
      {me.perms.includes('manage_ormas') && <div className="flex flex-wrap justify-end gap-2"><button type="button" className="btn-o py-1 text-red-600" disabled={busy} onClick={() => setRej(true)}>Tolak</button><button type="button" className="btn-p py-1" disabled={busy} onClick={() => setAsk(true)}>Verifikasi dan terapkan</button></div>}
      {ask && <Confirm title="Verifikasi perubahan" text="Data baru akan diterapkan ke katalog publik, dan PDF/logo baru dipindahkan ke folder ormas di penyimpanan resmi (Google Drive). PDF lama yang diganti akan dihapus. Lanjutkan?" onYes={() => act('verify', {}, 'Perubahan diverifikasi dan diterapkan')} onNo={() => setAsk(false)} />}
      {rej && <Modal title="Tolak perubahan" onClose={() => setRej(false)}>
        <p className="text-sm text-slate-700">Perubahan dari ormas dibuang dan data lama tetap dipakai. Tulis alasannya agar ormas tahu apa yang perlu diperbaiki (opsional, ditampilkan di Portal Ormas).</p>
        <textarea className="inp mt-3" rows={3} maxLength={900} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Alasan penolakan" />
        <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-o" onClick={() => setRej(false)}>Batal</button><button type="button" className="btn-d" disabled={busy} onClick={() => act('reject', { catatan: note }, 'Perubahan ditolak')}>Tolak perubahan</button></div>
      </Modal>}
    </div>
  );
}

function PortalCredModal({ acc, onClose }: { acc: any; onClose: () => void }) {
  const toast = useToast();
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast('Disalin'); } catch { toast('Gagal menyalin', false); } };
  const row = (l: string, v: string) => <div><span className="lbl">{l}</span><div className="flex items-center justify-between rounded bg-slate-100 px-3 py-2 font-mono text-sm">{v}<button type="button" className="text-slate-600" aria-label={`Salin ${l}`} onClick={() => copy(v)}><Copy size={15} /></button></div></div>;
  return (
    <Modal title={`Akun Portal ${acc.kode || ''}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="rounded bg-amber-50 p-3 text-sm text-slate-700">Catat sekarang. Password ini <b>hanya ditampilkan sekali</b> dan tidak bisa dilihat lagi. Berikan ke pengurus ormas. Mereka wajib menggantinya saat login pertama di halaman <b>Login Ormas</b>. Akun ini berbeda dari password harian untuk membuka PDF.</p>
        {row('Username', acc.username)}{row('Password awal', acc.password)}
        <div className="text-right"><button className="btn-p" onClick={onClose}>Sudah saya catat</button></div>
      </div>
    </Modal>
  );
}
