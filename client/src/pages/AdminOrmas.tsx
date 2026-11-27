import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, ChevronDown, ChevronUp, Copy, Download, ExternalLink, Eye, FileText, KeyRound, TriangleAlert, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { api } from '../api';
import { ANGGOTA_KEYS, BerlakuInput, Badge, Confirm, DOC_STATUS, DOC_TYPES, ADART, COMPANY_PROFILE, CompanyProfileGuide, CpChecklist, CpStatus, DOKUMENTASI, LegalBadge, LegalStatusFields, docAccept, docTypeOk, ExpBadge, InstagramIcon, KEMANTREN, LinkInputs, MemberInputs, VALIDASI, nf, rincian, tglIndo, Empty, ErrorBox, Modal, Pager, Skeleton, Spinner, fmtDate, fmtSize, qs, useDebounced, useFetch, useToast, WorkProgress } from '../ui';
import { useAuth } from './Admin';

export function OrmasPage() {
  const me = useAuth(); const toast = useToast();
  const [q, setQ] = useState(''); const [kat, setKat] = useState(''); const [sd, setSd] = useState(''); const [legal, setLegal] = useState(''); const [sort, setSort] = useState('kode'); const [dir, setDir] = useState('asc'); const [page, setPage] = useState(1);
  const [form, setForm] = useState<any>(null); const [detail, setDetail] = useState<number | null>(null); const [del, setDel] = useState<any>(null); const [newAcc, setNewAcc] = useState<any>(null);
  const dq = useDebounced(q); useEffect(() => setPage(1), [dq, kat, sd, legal]);
  const [sp, setSp] = useSearchParams();
  useEffect(() => { // parameter dari dashboard, notifikasi, dan pencarian di header
    const d = +(sp.get('detail') || 0), cari = sp.get('q'), baru = sp.get('tambah') === '1', lg = sp.get('legal_status');
    if (!d && cari == null && !baru && !lg) return;
    if (d) setDetail(d); if (cari != null) setQ(cari); if (lg) setLegal(lg); if (baru && me.perms.includes('manage_ormas')) setForm({});
    setSp({}, { replace: true });
  }, [sp]);
  const { data: exp } = useFetch<any>('/admin/kedaluwarsa?hari=90');
  const { data: meta } = useFetch<any>('/public/meta');
  const query = qs({ q: dq, kategori_id: kat, status_dokumen: sd, legal_status: legal, sort, dir, page, pageSize: 10 });
  const { data, loading, error, reload } = useFetch<any>('/admin/ormas?' + query);
  const can = (p: string) => me.perms.includes(p);
  const th = (key: string, label: string) => <th className={`th cursor-pointer select-none transition-colors hover:text-ink ${sort === key ? '!text-ink' : ''}`} aria-sort={sort === key ? (dir === 'asc' ? 'ascending' : 'descending') : undefined} onClick={() => { if (sort === key) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(key); setDir('asc'); } }}><span className="inline-flex items-center gap-1">{label}{sort === key && (dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</span></th>;
  const remove = async () => { try { await api(`/admin/ormas/${del.id}`, { method: 'DELETE' }); toast('Data ormas dihapus'); setDel(null); reload(); } catch (e: any) { toast(e.message, false); } };
  return (
    <div className="stagger space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Direktori internal</p><h1 className="page-title">Data Ormas</h1>{data && <p className="page-sub">{data.total} ormas sesuai filter saat ini</p>}</div>
        <div className="flex flex-wrap gap-2">{can('export') && <a className="btn-o" href={`/api/admin/export/ormas?${qs({ q: dq, kategori_id: kat, status_dokumen: sd, legal_status: legal })}`}><Download size={16} /> Ekspor Excel</a>}{can('manage_ormas') && <button className="btn-p" onClick={() => setForm({})}><Plus size={16} /> Tambah Ormas</button>}</div></div>
      {exp && (exp.sudah > 0 || exp.segera > 0) && <div className="note-warn flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2"><TriangleAlert size={18} className="shrink-0 text-warn" /><span>{exp.sudah > 0 && <b>{exp.sudah} dokumen sudah kedaluwarsa. </b>}{exp.segera > 0 && <>{exp.segera} dokumen akan berakhir dalam 90 hari. </>}Perhatikan label pada kolom Masa Berlaku.</span></span><Link className="txt-link" to="/admin/kedaluwarsa">Lihat daftar</Link></div>}
      <div className="card grid gap-3 p-3 md:grid-cols-5">
        <div className="relative md:col-span-2"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="inp pl-9" placeholder="Cari nama, ID, pengurus, atau nomor legal" aria-label="Cari" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="inp" aria-label="Kategori" value={kat} onChange={(e) => setKat(e.target.value)}><option value="">Semua kategori</option>{meta?.categories.map((c: any) => <option key={c.id} value={c.id}>{c.nama_kategori}</option>)}</select>
        <select className="inp" aria-label="Status dokumen" value={sd} onChange={(e) => setSd(e.target.value)}><option value="">Semua status dokumen</option>{DOC_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="inp" aria-label="Status Legal Standing" value={legal} onChange={(e) => setLegal(e.target.value)}><option value="">Semua Legal Standing</option><option value="ya">Sudah memiliki</option><option value="tidak">Tidak memiliki</option><option value="belum">Belum dijawab</option></select>
        {/* Di ponsel kepala tabel disembunyikan, jadi pengurutan dipilih di sini */}
        <select className="inp md:hidden" aria-label="Urutkan" value={`${sort}:${dir}`} onChange={(e) => { const [k, d] = e.target.value.split(':'); setSort(k); setDir(d); }}>
          {[['kode', 'ID Ormas'], ['nama', 'Nama'], ['kategori', 'Kategori'], ['ketua', 'Ketua'], ['sk', 'Legal Standing'], ['status', 'Status dokumen']].flatMap(([k, l]) => [<option key={k + 'a'} value={`${k}:asc`}>Urutkan: {l} (naik)</option>, <option key={k + 'd'} value={`${k}:desc`}>Urutkan: {l} (turun)</option>])}
        </select>
      </div>
      <div className="card-solid overflow-x-auto">
        {error ? <div className="p-4"><ErrorBox text={error} retry={reload} /></div> : loading && !data ? <Skeleton /> : !data?.items.length ? <Empty text="Tidak ada data ormas yang cocok." /> : (
          <table className="tbl tbl-dense"><thead><tr><th className="th">No</th><th className="th">Logo</th>{th('kode', 'ID Ormas')}{th('nama', 'Nama Lengkap Ormas')}{th('kategori', 'Kategori')}{th('ketua', 'Ketua / Sekretaris / Bendahara')}{th('sk', 'Legal Standing')}<th className="th">Masa Berlaku</th>{th('status', 'Status Dokumen')}<th className="th col-act">Aksi</th></tr></thead>
            <tbody>{data.items.map((o: any, i: number) => (
              <tr key={o.id}><td data-label="No" className="td"><div>{(page - 1) * 10 + i + 1}</div></td>
                <td data-label="Logo" className="td"><div>{o.has_logo ? <img src={`/api/logo/${o.kode_ormas}?v=${encodeURIComponent(o.updated_at)}`} className="h-10 w-10 rounded-xl object-cover" alt="" /> : <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-soft/60 text-gold"><Building2 size={16} /></span>}</div></td>
                <td data-label="ID Ormas" className="td mono font-semibold text-link"><div>{o.kode_ormas}</div></td><td data-label="Nama" className="td min-w-[170px]"><div>{o.nama_ormas}<div className="text-xs text-muted">{o.status_operasional} · {o.status_publikasi === 'Publik' ? 'Tampil di katalog' : 'Disembunyikan'}</div></div></td><td data-label="Kategori" className="td"><div>{o.nama_kategori}</div></td><td data-label="Pengurus" className="td min-w-[135px] text-xs"><div><b>{o.nama_ketua || '-'}</b><br />{o.sekretaris || '-'}<br />{o.bendahara || '-'}<div className="mt-1 border-t border-line pt-1 text-muted">Anggota: <b>{nf(o.anggota_total)}</b>{o.anggota_total != null && rincian(o, true) && <span className="text-muted"> ({rincian(o, true)})</span>}</div></div></td><td data-label="Legal" className="td text-xs"><div><LegalBadge status={o.legal_status} />{(o.legal_status || '') === 'ya' && <div className="mt-1">{o.legal_jenis || '-'}<br />{o.nomor_sk || '-'}{o.legal_tahun ? ` / ${o.legal_tahun}` : ''}</div>}{o.validasi && <div className="mt-1"><span className="chip text-gold">{o.validasi}</span></div>}</div></td>
                <td data-label="Masa berlaku" className="td min-w-[140px] text-xs"><div><div><span className="text-muted">SKTO s/d</span> <b>{o.exp.skto.tgl ? tglIndo(o.exp.skto.tgl) : o.skto_berlaku_sd || '-'}</b><br /><ExpBadge e={o.exp.skto} /></div><div className="mt-1"><span className="text-muted">Legal s/d</span> <b>{o.exp.legal.tgl ? tglIndo(o.exp.legal.tgl) : o.legal_berlaku_sd || '-'}</b><br /><ExpBadge e={o.exp.legal} /></div></div></td>
                <td data-label="Status" className="td"><div><Badge s={o.status_dokumen} /><div className="mt-1 text-xs text-muted">{o.jumlah_dok}/5 dokumen</div>{o.has_pending ? <div className="mt-1 text-xs font-semibold text-info">Ada perubahan baru dari ormas</div> : null}</div></td>
                <td data-label="Aksi" className="td col-act"><div className="flex gap-1.5">
                  <button className="icon-btn" title="Lihat detail" aria-label="Lihat detail" onClick={() => setDetail(o.id)}><Eye size={15} /></button>
                  {can('manage_ormas') && <><button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => (o.has_pending ? toast('Ormas ini punya perubahan yang menunggu verifikasi. Buka Detail untuk memverifikasi atau menolaknya sebelum mengedit.', false) : setForm(o))}><Pencil size={15} /></button><button className="icon-btn hover:!border-bad/50 hover:!text-bad" title="Hapus" aria-label="Hapus" onClick={() => setDel(o)}><Trash2 size={15} /></button></>}
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

const KEYS = ['nama_ormas', 'kategori_id', 'bentuk', 'bidang_kegiatan', 'kemantren', 'validasi', 'nama_ketua', 'sekretaris', 'bendahara', 'nomor_whatsapp_ketua', 'telepon_ormas', 'email_ormas', 'alamat', 'legal_status', 'legal_jenis', 'nomor_sk', 'legal_tahun', 'legal_berlaku_sd', 'skto_nomor', 'skto_tahun', 'skto_berlaku_sd', 'status_dokumen', 'status_operasional', 'status_publikasi', 'catatan_verifikasi', ...ANGGOTA_KEYS, 'link_dokumentasi', 'link_instagram', 'link_youtube', 'link_tiktok', 'cp_bagian'];
const DEFAULTS: any = { status_dokumen: 'Belum Lengkap', status_operasional: 'Aktif', status_publikasi: 'Disembunyikan' };

function OrmasForm({ item, cats, meta, onClose, onSaved }: any) {
  const toast = useToast(); const edit = !!item.id; const maxMb = meta?.max_pdf_mb || 20;
  const [f, setF] = useState<any>(() => Object.fromEntries(KEYS.map((k) => [k, item[k] ?? DEFAULTS[k] ?? ''])));
  const [logo, setLogo] = useState<File | null>(null); const [rmLogo, setRmLogo] = useState(false);
  const [files, setFiles] = useState<Record<string, File>>({}); const [docs, setDocs] = useState<any[]>([]); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState('');
  useEffect(() => { if (edit) api(`/admin/ormas/${item.id}`).then((d) => setDocs(d.docs)).catch(() => {}); }, []);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const T = (k: string, label: string, o: any = {}) => (
    <div className={o.span ? 'md:col-span-2' : ''}><label className="lbl" htmlFor={k}>{label}</label><input id={k} type={o.type || 'text'} list={o.list} className="inp" placeholder={o.ph} maxLength={o.max} value={f[k]} onChange={(e) => set(k, e.target.value)} /></div>
  );
  const H = (t: string) => <h3 className="form-h">{t}</h3>;
  const pick = (j: string, x?: File) => {
    if (!x) return;
    if (!docTypeOk(j, x)) return toast(`"${x.name}" format tidak didukung${j === 'company_profile' ? ' (PDF, PPT, atau PPTX)' : ' (harus PDF)'}`, false);
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
    setBusy(true); setProgress(f.nama_ormas);
    const fd = new FormData(); KEYS.forEach((k) => fd.append(k, String(f[k] ?? '')));
    Object.entries(files).forEach(([j, x]) => fd.append(j, x)); if (logo) fd.append('logo', logo); if (rmLogo) fd.append('remove_logo', '1');
    try { const r = await api(edit ? `/admin/ormas/${item.id}` : '/admin/ormas', { method: edit ? 'PUT' : 'POST', form: fd }); toast(edit ? 'Perubahan disimpan' : 'Ormas berhasil ditambahkan'); onSaved(r); }
    catch (x: any) { toast(x.message, false); setBusy(false); }
    finally { setProgress(''); }
  };
  return (
    <Modal wide title={edit ? `Edit ${item.kode_ormas}` : 'Tambah Ormas'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        {H('Identitas Ormas')}
        <div><span className="lbl">ID Ormas</span><div className="readonly">{edit ? item.kode_ormas : 'Dibuat otomatis oleh sistem'}</div></div>
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
        {H('Kontak dan Alamat')}
        {T('nomor_whatsapp_ketua', 'Nomor telepon pribadi ketua', { type: 'tel', ph: '081234567890', max: 25 })}
        {T('telepon_ormas', 'Nomor telepon resmi ormas', { type: 'tel', ph: '0274 000 0000', max: 25 })}
        <p className="text-xs text-muted md:col-span-2">Nomor ketua ditampilkan tersamarkan di katalog publik; nomor telepon ormas ditampilkan lengkap. Admin melihat keduanya utuh.</p>
        {T('email_ormas', 'Email ormas', { type: 'email', ph: 'nama@contoh.id' })}
        <div className="md:col-span-2"><label className="lbl" htmlFor="al">Alamat kantor / sekretariat <span className="font-normal text-muted">(tulis selengkap mungkin, dipakai untuk peta di halaman publik)</span></label><textarea id="al" rows={2} maxLength={500} className="inp" value={f.alamat} onChange={(e) => set('alamat', e.target.value)} /></div>
        {H('Jumlah Anggota')}
        <MemberInputs f={f} set={set} />
        {H('Legal Standing')}
        <LegalStatusFields f={f} set={set} />
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
            <div key={j} className={`drop ${files[j] || cur ? 'drop-on' : ''}`}>
              <label className="lbl" htmlFor={'f_' + j}>{l} {!edit && '*'}</label>
              <input id={'f_' + j} type="file" accept="application/pdf" className="w-full text-xs" onChange={(e) => { pick(j, e.target.files?.[0]); e.target.value = ''; }} />
              <p className="mt-1 text-xs text-muted">{files[j] ? <>Akan diunggah: <b>{files[j].name}</b> ({fmtSize(files[j].size)}) <button type="button" className="text-bad underline" onClick={() => setFiles((p) => { const n = { ...p }; delete n[j]; return n; })}>batal</button></> : cur ? <>Tersimpan: {cur.nama_file} ({fmtSize(cur.ukuran_file)}). Pilih file baru untuk mengganti.</> : edit ? 'Belum diunggah' : 'Wajib diunggah'}</p>
            </div>); })}
        </div>
        {H('Dokumen Tambahan (opsional)')}
        <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
          {[ADART, COMPANY_PROFILE].map(([j, l]) => { const cur = docs.find((d: any) => d.jenis_dokumen === j); return (
            <div key={j} className={`drop ${files[j] || cur ? 'drop-on' : ''}`}>
              <label className="lbl" htmlFor={'f_' + j}>{l}{j === 'company_profile' ? ' (PDF / PPT / PPTX, tampil terbuka di katalog)' : ' (PDF)'}</label>
              <input id={'f_' + j} type="file" accept={docAccept(j)} className="w-full text-xs" onChange={(e) => { pick(j, e.target.files?.[0]); e.target.value = ''; }} />
              <p className="mt-1 text-xs text-muted">{files[j] ? <>Akan diunggah: <b>{files[j].name}</b> ({fmtSize(files[j].size)}) <button type="button" className="text-bad underline" onClick={() => setFiles((p) => { const n = { ...p }; delete n[j]; return n; })}>batal</button></> : cur ? <>Tersimpan: {cur.nama_file} ({fmtSize(cur.ukuran_file)})</> : 'Belum diunggah'}</p>
            </div>); })}
        </div>
        <CompanyProfileGuide />
        <div className="md:col-span-2"><CpStatus cpBagian={f.cp_bagian} hasFile={docs.some((d: any) => d.jenis_dokumen === 'company_profile')} /></div>
        <CpChecklist value={f.cp_bagian ?? ''} onChange={(v) => set('cp_bagian', v)} />
        {H('Dokumentasi Kegiatan dan Media Sosial (opsional)')}
        <LinkInputs f={f} set={set} />
        {(() => { const [j, l] = DOKUMENTASI; const cur = docs.find((d) => d.jenis_dokumen === j); return (
          <div className={`drop md:col-span-2 ${files[j] || cur ? 'drop-on' : ''}`}>
            <label className="lbl" htmlFor="f_dok">Unggah {l} (PDF)</label>
            <input id="f_dok" type="file" accept="application/pdf" className="w-full text-xs" onChange={(e) => { pick(j, e.target.files?.[0]); e.target.value = ''; }} />
            <p className="mt-1 text-xs text-muted">{files[j] ? <>Akan diunggah: <b>{files[j].name}</b> ({fmtSize(files[j].size)}) <button type="button" className="text-bad underline" onClick={() => setFiles((p) => { const n = { ...p }; delete n[j]; return n; })}>batal</button></> : cur ? <>Tersimpan: {cur.nama_file} ({fmtSize(cur.ukuran_file)}). Pilih file baru untuk mengganti.</> : 'Tidak wajib. Kumpulkan foto kegiatan menjadi satu PDF, atau cukup pakai link di atas.'}</p>
          </div>); })()}
        <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 rounded-b-2xl border-t border-line bg-surface px-5 py-3 md:col-span-2"><button type="button" className="btn-o" onClick={onClose}>Batal</button><button className="btn-p" disabled={busy}>{busy ? <><Spinner /> Menyimpan…</> : 'Simpan'}</button></div>
      </form>
      {progress && <WorkProgress title={edit ? 'Menyimpan perubahan ormas' : 'Menambahkan ormas baru'} subject={progress} />}
    </Modal>
  );
}

function Detail({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const me = useAuth(); const { data: o, error, reload } = useFetch<any>(`/admin/ormas/${id}`); const [view, setView] = useState<any>(null); const [ask, setAsk] = useState(false); const [acc, setAcc] = useState<any>(null);
  const resetPortal = async () => { try { const r = await api(`/admin/ormas/${id}/portal-reset`, { method: 'POST', body: {} }); setAcc({ ...r, kode: o.kode_ormas }); setAsk(false); reload(); } catch (e: any) { alert(e.message); } };
  const row = (l: string, v: any) => <div className="min-w-0"><dt className="text-xs text-muted">{l}</dt><dd className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{v || '-'}</dd></div>;
  const lbl = (j: string) => DOC_TYPES.find(([k]) => k === j)?.[1] || 'Dokumen lain';
  const wa = (n: string) => n ? <a className="text-link underline" target="_blank" rel="noreferrer" href={`https://wa.me/${n.replace(/\D/g, '').replace(/^0/, '62')}`}>{n}</a> : '';
  return (
    <Modal drawer title="Detail Ormas" onClose={onClose}>
      {error ? <ErrorBox text={error} /> : !o ? <Skeleton rows={4} /> : (
        <div className="space-y-4">
          <div className="panel flex items-center gap-4">{o.has_logo ? <img src={`/api/logo/${o.kode_ormas}?v=${encodeURIComponent(o.updated_at)}`} className="h-16 w-16 shrink-0 rounded-2xl object-cover" alt="" /> : <span className="brand-mark h-16 w-16 !rounded-2xl"><Building2 /></span>}<div className="min-w-0"><p className="eyebrow">{o.kode_ormas}</p><h3 className="mt-1 text-xl font-bold leading-snug">{o.nama_ormas}</h3><div className="mt-2 flex flex-wrap gap-2"><Badge s={o.status_dokumen} /><span className="chip-n">{o.status_operasional}</span></div></div></div>
          {o.pending && <PendingPanel o={o} onDone={() => { reload(); onChanged(); }} />}
          <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
            {row('Kategori', o.nama_kategori)}{row('Bentuk', o.bentuk)}{row('Kemantren', o.kemantren)}{row('Bidang kegiatan', o.bidang_kegiatan)}{row('Status validasi', o.validasi)}{row('Status dokumen', <Badge s={o.status_dokumen} />)}
            {row('Ketua', o.nama_ketua)}{row('Sekretaris', o.sekretaris)}{row('Bendahara', o.bendahara)}{row('Telepon pribadi ketua', wa(o.nomor_whatsapp_ketua))}{row('Telepon ormas', o.telepon_ormas)}{row('Email ormas', o.email_ormas)}{row('Alamat kantor / sekretariat', o.alamat)}
            {row('Legal standing', <><LegalBadge status={o.legal_status} />{(o.legal_status || '') === 'ya' && <div className="mt-1">{[o.legal_jenis, o.nomor_sk, o.legal_tahun && `Tahun ${o.legal_tahun}`, o.exp.legal.tgl ? `s/d ${tglIndo(o.exp.legal.tgl)}` : o.legal_berlaku_sd && `s/d ${o.legal_berlaku_sd}`].filter(Boolean).join(' · ') || '-'}<br /><ExpBadge e={o.exp.legal} full /></div>}</>)}{row('SKTO', <>{[o.skto_nomor, o.skto_tahun && `Tahun ${o.skto_tahun}`, o.exp.skto.tgl ? `s/d ${tglIndo(o.exp.skto.tgl)}` : o.skto_berlaku_sd && `s/d ${o.skto_berlaku_sd}`].filter(Boolean).join(' · ') || '-'}<br /><ExpBadge e={o.exp.skto} full /></>)}
            {row('Jumlah anggota', nf(o.anggota_total))}{row('Perempuan', nf(o.anggota_perempuan))}{row('Lansia', nf(o.anggota_lansia))}{row('Disabilitas', nf(o.anggota_disabilitas))}
            {row('Link dokumentasi', o.link_dokumentasi && <a className="text-link underline" target="_blank" rel="noreferrer" href={o.link_dokumentasi}>Buka tautan</a>)}{row('Instagram', o.link_instagram && <a className="inline-flex items-center gap-1 text-bad underline" target="_blank" rel="noreferrer" href={o.link_instagram}><InstagramIcon size={14} />Buka Instagram</a>)}
            {row('Company Profile', <CpStatus cpBagian={o.cp_bagian} hasFile={o.docs.some((x: any) => x.jenis_dokumen === 'company_profile')} />)}
            {row('YouTube', o.link_youtube && <a className="text-bad underline" target="_blank" rel="noreferrer" href={o.link_youtube}>Buka YouTube</a>)}{row('TikTok', o.link_tiktok && <a className="text-link underline" target="_blank" rel="noreferrer" href={o.link_tiktok}>Buka TikTok</a>)}
            {row('Status operasional', o.status_operasional)}{row('Status publikasi', o.status_publikasi)}{row('Diperbarui', fmtDate(o.updated_at))}
          </dl>
          {o.catatan_verifikasi && <p className="panel text-sm"><b>Catatan verifikasi:</b> {o.catatan_verifikasi}</p>}
          <div className="panel text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-semibold"><KeyRound size={14} className="mr-1 inline" />Akun portal ormas (untuk mengubah biodata)</h4><p className="text-xs text-muted">{o.portal ? <>Username: <b>{o.portal.username}</b> · login terakhir: {o.portal.last_login ? fmtDate(o.portal.last_login) : 'belum pernah'}{o.portal.must_change ? ' · password awal belum diganti ormas' : ''}</> : 'Belum dibuat'}</p></div>{me.perms.includes('manage_ormas') && <button className="btn-o py-1" onClick={() => setAsk(true)}>{o.portal ? 'Atur ulang password' : 'Buat akun'}</button>}</div></div>
          <div><h4 className="mb-2 font-semibold">Dokumen PDF</h4>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">{DOC_TYPES.map(([j, l]) => { const d = o.docs.find((x: any) => x.jenis_dokumen === j); return (
              <li key={j} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span><FileText size={14} className={`mr-1 inline ${d ? 'text-bad' : 'text-muted/40'}`} /><b>{l}</b><span className="block text-xs text-muted">{d ? `${d.nama_file} · ${fmtSize(d.ukuran_file)} · ${fmtDate(d.uploaded_at)}` : 'Belum diunggah'}</span></span>
                {d && me.perms.includes('view_docs') && <span className="flex gap-2"><button className="btn-p py-1" onClick={() => setView(view?.id === d.id ? null : d)}><ExternalLink size={14} /> Buka PDF</button><a className="btn-o py-1" href={`/api/admin/files/${d.id}?dl=1`}><Download size={14} /> Download</a></span>}</li>); })}
              {(() => { const d = o.docs.find((x: any) => x.jenis_dokumen === 'dokumentasi'); return d ? <li className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span><FileText size={14} className="mr-1 inline text-bad" /><b>Dokumentasi Kegiatan</b><span className="block text-xs text-muted">{d.nama_file} · {fmtSize(d.ukuran_file)} · {fmtDate(d.uploaded_at)}</span></span>{me.perms.includes('view_docs') && <span className="flex gap-2"><button className="btn-p py-1" onClick={() => setView(view?.id === d.id ? null : d)}><ExternalLink size={14} /> Buka PDF</button><a className="btn-o py-1" href={`/api/admin/files/${d.id}?dl=1`}><Download size={14} /> Download</a></span>}</li> : null; })()}
              {[ADART, COMPANY_PROFILE].map(([j, l]) => { const d = o.docs.find((x: any) => x.jenis_dokumen === j); return d ? <li key={j} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span><FileText size={14} className="mr-1 inline text-bad" /><b>{l}{j === 'company_profile' ? ' (terbuka untuk publik)' : ''}</b><span className="block text-xs text-muted">{d.nama_file} · {fmtSize(d.ukuran_file)} · {fmtDate(d.uploaded_at)}</span></span>{me.perms.includes('view_docs') && <a className="btn-o py-1" href={`/api/admin/files/${d.id}?dl=1`}><Download size={14} /> Download</a>}</li> : null; })}
              {o.docs.filter((x: any) => !x.jenis_dokumen).map((d: any) => <li key={d.id} className="flex items-center justify-between p-3 text-sm"><span>{d.nama_file} <span className="text-xs text-muted">(dokumen lama)</span></span>{me.perms.includes('view_docs') && <a className="btn-o py-1" href={`/api/admin/files/${d.id}?dl=1`}><Download size={14} /></a>}</li>)}
            </ul></div>
          {view && <iframe title={view.nama_file} src={`/api/admin/files/${view.id}`} className="h-[60vh] w-full rounded-xl border border-line bg-white" />}
        </div>)}
      {ask && <Confirm title="Atur ulang password portal" text="Password portal ormas ini akan diganti dengan password baru. Password lama langsung tidak berlaku dan ormas diminta menggantinya saat login pertama. Lanjutkan?" onYes={resetPortal} onNo={() => setAsk(false)} />}
      {acc && <PortalCredModal acc={acc} onClose={() => setAcc(null)} />}
    </Modal>
  );
}

const FIELD_LABELS: [string, string][] = [['bentuk', 'Bentuk'], ['bidang_kegiatan', 'Bidang kegiatan'], ['kemantren', 'Kemantren'], ['nama_ketua', 'Ketua'], ['sekretaris', 'Sekretaris'], ['bendahara', 'Bendahara'], ['nomor_whatsapp_ketua', 'Telepon pribadi ketua'], ['telepon_ormas', 'Telepon ormas'], ['email_ormas', 'Email ormas'], ['alamat', 'Alamat kantor / sekretariat'], ['legal_status', 'Legal standing: status kepemilikan'], ['legal_jenis', 'Legal standing: jenis'], ['nomor_sk', 'Legal standing: nomor'], ['legal_tahun', 'Legal standing: tahun'], ['legal_berlaku_sd', 'Legal standing: berlaku s/d'], ['skto_nomor', 'SKTO: nomor'], ['skto_tahun', 'SKTO: tahun'], ['skto_berlaku_sd', 'SKTO: berlaku s/d'], ['anggota_total', 'Jumlah total anggota'], ['anggota_perempuan', 'Anggota perempuan'], ['anggota_lansia', 'Anggota lansia'], ['anggota_disabilitas', 'Anggota disabilitas'], ['link_dokumentasi', 'Link dokumentasi'], ['link_instagram', 'Instagram'], ['link_youtube', 'YouTube'], ['link_tiktok', 'TikTok'], ['cp_bagian', 'Bagian Company Profile']];

// Perubahan dari portal ormas yang menunggu verifikasi. Selama belum diverifikasi, katalog publik dan Google Drive tetap memakai data lama.
function PendingPanel({ o, onDone }: { o: any; onDone: () => void }) {
  const me = useAuth(); const toast = useToast(); const p = o.pending;
  const [view, setView] = useState<any>(null); const [busy, setBusy] = useState(false); const [ask, setAsk] = useState(false); const [rej, setRej] = useState(false); const [note, setNote] = useState(''); const [progress, setProgress] = useState(false);
  const diffs = FIELD_LABELS.filter(([k]) => String(p.data[k] ?? '') !== String(o[k] ?? ''));
  const lbl = (j: string) => [...DOC_TYPES, DOKUMENTASI].find(([k]) => k === j)?.[1] || 'Dokumen';
  const act = async (path: string, body: any, okMsg: string) => {
    if (busy) return; setBusy(true); setAsk(false); setRej(false); if (path === 'verify') setProgress(true);
    try { await api(`/admin/ormas/${o.id}/${path}`, { method: 'POST', body }); toast(okMsg); onDone(); }
    catch (e: any) { toast(e.message, false); setBusy(false); setAsk(false); setRej(false); }
    finally { setProgress(false); setBusy(false); }
  };
  return (
    <div className="note-info space-y-3">
      <div><h4 className="font-semibold text-info">Perubahan dari ormas menunggu verifikasi</h4><p className="text-xs text-muted">Diajukan {fmtDate(p.updated_at)}. Data lain pada halaman ini dan katalog publik masih data lama sampai Anda memverifikasinya.</p></div>
      {diffs.length > 0 && <ul className="divide-y divide-line rounded-xl border border-line bg-surface">{diffs.map(([k, l]) => <li key={k} className="p-2 text-xs"><b className="block text-body">{l}</b><span className="text-muted line-through [overflow-wrap:anywhere]">{o[k] || '(kosong)'}</span> <span className="[overflow-wrap:anywhere]">→ <b>{p.data[k] || '(kosong)'}</b></span></li>)}</ul>}
      {p.logo === 'baru' && <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2 text-xs"><img src={`/api/logo/${o.kode_ormas}?pending=1&v=${encodeURIComponent(p.updated_at)}`} alt="" className="h-12 w-12 rounded object-cover" /><b>Logo baru diunggah</b></div>}
      {p.logo === 'hapus' && <p className="rounded-xl border border-line bg-surface p-2 text-xs"><b>Logo ormas akan dihapus</b></p>}
      {p.docs.length > 0 && <ul className="divide-y divide-line rounded-xl border border-line bg-surface">{p.docs.map((d: any) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-2 text-xs"><span><FileText size={13} className="mr-1 inline text-bad" /><b>{lbl(d.jenis_dokumen)}</b> (baru)<span className="block text-muted">{d.nama_file} · {fmtSize(d.ukuran_file)}</span></span>
          {me.perms.includes('view_docs') && <span className="flex gap-2"><button type="button" className="btn-p py-1" onClick={() => setView(view?.id === d.id ? null : d)}><ExternalLink size={13} /> Buka PDF</button><a className="btn-o py-1" href={`/api/admin/files/${d.id}?dl=1`}><Download size={13} /> Download</a></span>}</li>))}</ul>}
      {view && <iframe title={view.nama_file} src={`/api/admin/files/${view.id}`} className="h-[55vh] w-full rounded-xl border border-line bg-surface" />}
      {me.perms.includes('manage_ormas') && <div className="flex flex-wrap justify-end gap-2"><button type="button" className="btn-d py-1" disabled={busy} onClick={() => setRej(true)}>Tolak</button><button type="button" className="btn-p py-1" disabled={busy} onClick={() => setAsk(true)}>Verifikasi dan terapkan</button></div>}
      {ask && <Confirm title="Verifikasi perubahan" text="Data baru akan diterapkan ke katalog publik, dan PDF/logo baru dipindahkan ke folder ormas di penyimpanan resmi (Google Drive). PDF lama yang diganti akan dihapus. Lanjutkan?" onYes={() => act('verify', {}, 'Perubahan diverifikasi dan diterapkan')} onNo={() => setAsk(false)} />}
      {rej && <Modal title="Tolak perubahan" onClose={() => setRej(false)}>
        <p className="text-sm text-body">Perubahan dari ormas dibuang dan data lama tetap dipakai. Tulis alasannya agar ormas tahu apa yang perlu diperbaiki (opsional, ditampilkan di Portal Ormas).</p>
        <textarea className="inp mt-3" rows={3} maxLength={900} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Alasan penolakan" />
        <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-o" onClick={() => setRej(false)}>Batal</button><button type="button" className="btn-d" disabled={busy} onClick={() => act('reject', { catatan: note }, 'Perubahan ditolak')}>Tolak perubahan</button></div>
      </Modal>}
      {progress && <WorkProgress title="Memverifikasi perubahan ormas" subject={`${o.kode_ormas} — ${o.nama_ormas}`} />}
    </div>
  );
}

function PortalCredModal({ acc, onClose }: { acc: any; onClose: () => void }) {
  const toast = useToast();
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast('Disalin'); } catch { toast('Gagal menyalin', false); } };
  const row = (l: string, v: string) => <div><span className="lbl">{l}</span><div className="flex items-center justify-between readonly flex items-center justify-between font-mono !text-ink">{v}<button type="button" className="text-muted" aria-label={`Salin ${l}`} onClick={() => copy(v)}><Copy size={15} /></button></div></div>;
  return (
    <Modal title={`Akun Portal ${acc.kode || ''}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="note-warn">Catat sekarang. Password ini <b>hanya ditampilkan sekali</b> dan tidak bisa dilihat lagi. Berikan ke pengurus ormas. Mereka wajib menggantinya saat login pertama di halaman <b>Login Ormas</b>. Akun ini hanya untuk mengelola data ormas; dokumen katalog publik dibuka tanpa akun.</p>
        {row('Username', acc.username)}{row('Password awal', acc.password)}
        <div className="text-right"><button className="btn-p" onClick={onClose}>Sudah saya catat</button></div>
      </div>
    </Modal>
  );
}
