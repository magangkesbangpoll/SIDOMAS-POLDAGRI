import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../ui';

type Cat = { id?: number; nama_kategori: string; status_aktif: boolean };

export function CategoryManager({ initial, onSaved }: { initial: any[]; onSaved?: () => void }) {
  const toast = useToast();
  const toRows = (src: any[]): Cat[] => src.map((c) => ({ id: c.id, nama_kategori: c.nama_kategori, status_aktif: !!c.status_aktif }));
  const [rows, setRows] = useState<Cat[]>(() => toRows(initial));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!dirty) setRows(toRows(initial)); }, [initial]);

  const change = (next: Cat[]) => { setRows(next); setDirty(true); };
  const edit = (i: number, patch: Partial<Cat>) => change(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= rows.length) return;
    const n = [...rows]; [n[i], n[j]] = [n[j], n[i]]; change(n);
  };
  const remove = (i: number) => {
    if (!window.confirm(`Hapus kategori "${rows[i].nama_kategori || 'baru'}"? Perubahan baru tersimpan setelah klik SIMPAN.`)) return;
    change(rows.filter((_, j) => j !== i));
  };
  const add = () => change([...rows, { nama_kategori: '', status_aktif: true }]);
  const cancel = () => { setRows(toRows(initial)); setDirty(false); };

  const save = async () => {
    if (busy) return;
    if (rows.some((r) => !r.nama_kategori.trim())) return toast('Nama kategori tidak boleh kosong', false);
    setBusy(true);
    try {
      await api('/admin/categories', { method: 'PUT', body: { items: rows.map((r) => ({ ...r, nama_kategori: r.nama_kategori.trim() })) } });
      toast('Kategori disimpan');
      setDirty(false);
      onSaved?.();
    } catch (e: any) { toast(e.message, false); } finally { setBusy(false); }
  };

  return (
    <div className="card space-y-3 p-4">
      <div>
        <h3 className="text-lg font-bold text-ink">Kategori Bidang</h3>
        <p className="text-xs text-muted">Tambah, ubah nama, ubah urutan, atau hapus kategori. Perubahan baru berlaku setelah menekan SIMPAN. Kategori yang masih dipakai ormas tidak bisa dihapus, nonaktifkan saja.</p>
      </div>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.id ?? `n${i}`} className="panel flex flex-wrap items-center gap-2 !p-2">
            <span className="w-6 text-center text-xs text-muted">{i + 1}</span>
            <input className="inp min-w-[180px] flex-1" aria-label={`Nama kategori ${i + 1}`} placeholder="Nama kategori" maxLength={80} value={r.nama_kategori} onChange={(e) => edit(i, { nama_kategori: e.target.value })} />
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={r.status_aktif} onChange={(e) => edit(i, { status_aktif: e.target.checked })} />Aktif</label>
            <button type="button" className="btn-o px-2 py-1" title="Naik" aria-label="Naikkan" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
            <button type="button" className="btn-o px-2 py-1" title="Turun" aria-label="Turunkan" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
            <button type="button" className="btn-o px-2 py-1 text-bad" title="Hapus" aria-label="Hapus" onClick={() => remove(i)}><Trash2 size={15} /></button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="btn-o" onClick={add}><Plus size={16} /> Tambah kategori</button>
        <div className="flex gap-2">
          {dirty && <button type="button" className="btn-o" onClick={cancel} disabled={busy}>Batalkan perubahan</button>}
          <button type="button" className="btn-p" onClick={save} disabled={busy || !dirty}><Save size={16} /> {busy ? 'Menyimpan…' : 'SIMPAN'}</button>
        </div>
      </div>
    </div>
  );
}
