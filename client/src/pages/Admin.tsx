import React, { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, Building2, CalendarClock, FileDown, KeyRound, LayoutDashboard, LogOut, Menu, UserPlus, ScrollText, Settings, Users } from 'lucide-react';
import { api } from '../api';
import { useFetch } from '../ui';
import { ChangePassword } from './AdminAuth';
import { NotifBell } from './Notifikasi';

const Ctx = createContext<any>(null);
export const useAuth = () => useContext(Ctx);
const MENU: [string, string, any, string | null][] = [
  ['/admin', 'Dashboard', LayoutDashboard, null], ['/admin/ormas', 'Data Ormas', Building2, 'view_ormas'], ['/admin/pendaftaran', 'Pendaftaran Baru', UserPlus, 'view_ormas'], ['/admin/kedaluwarsa', 'Dokumen Kedaluwarsa', CalendarClock, 'view_ormas'], ['/admin/notifikasi', 'Notifikasi', Bell, null], ['/admin/password-harian', 'Password Harian', KeyRound, 'view_credentials'],
  ['/admin/akun', 'Manajemen Admin', Users, 'manage_admins'], ['/admin/ekspor', 'Ekspor Data', FileDown, 'export'], ['/admin/log', 'Log Aktivitas', ScrollText, 'view_logs'], ['/admin/pengaturan', 'Pengaturan', Settings, 'manage_settings'],
];

export function AdminShell() {
  const nav = useNavigate(); const [me, setMe] = useState<any>(null); const [collapsed, setCollapsed] = useState(false); const [open, setOpen] = useState(false);
  const load = () => api('/admin/me').then(setMe).catch(() => nav('/admin/login', { replace: true }));
  useEffect(() => { load(); }, []);
  const { data: pc } = useFetch<any>('/admin/pendaftaran/count'); // realtime: jumlah pendaftaran baru
  if (!me) return <div className="grid min-h-screen place-items-center text-slate-500">Memuat…</div>;
  if (me.must_change) return <ChangePassword onDone={load} askEmail={String(me.email).endsWith('@sidomas.local')} />;
  const logout = async () => { await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {}); nav('/admin/login'); };
  const items = MENU.filter(([, , , perm]) => !perm || me.perms.includes(perm)).map(([to, l, I, p]) => [to, to === '/admin/pendaftaran' && pc?.count ? `${l} (${pc.count})` : l, I, p] as [string, string, any, string | null]);
  const link = ({ isActive }: any) => `anim-slide group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 ${isActive ? 'bg-gradient-to-r from-gold-500 to-gold-400 text-navy-900 shadow-lg shadow-gold-500/20' : 'text-navy-100 hover:translate-x-0.5 hover:bg-white/10 hover:text-white'}`;
  const initial = String(me.nama || '?').trim().charAt(0).toUpperCase();
  return (
    <Ctx.Provider value={me}>
      <div className="flex min-h-screen">
        {open && <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />}
        <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-gradient-to-b from-navy-900 to-navy-800 p-3 shadow-xl transition-all md:static ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${collapsed ? 'md:w-16' : 'md:w-60'} w-60`}>
          <div className="mb-4 flex items-center gap-3 border-b border-white/10 px-2 py-3 text-white"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold-500 text-navy-900 shadow-lg"><Building2 size={18} /></span>{!collapsed && <span className="font-serif text-lg font-bold">SIDOMAS</span>}</div>
          <nav className="flex-1 space-y-1">{items.map(([to, label, Icon], i) => <NavLink key={to} to={to} end={to === '/admin'} className={link} style={{ animationDelay: `${i * 40}ms` }} onClick={() => setOpen(false)} title={label}><Icon size={18} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />{!collapsed && label}</NavLink>)}</nav>
          <button onClick={logout} className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-navy-100 transition-all duration-200 hover:bg-red-500/20 hover:text-white" title="Logout"><LogOut size={18} className="shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />{!collapsed && 'Logout'}</button>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur">
            <button className="btn-o px-2" aria-label="Menu" onClick={() => (window.innerWidth < 768 ? setOpen(!open) : setCollapsed(!collapsed))}><Menu size={18} /></button>
            <div className="flex items-center gap-3"><NotifBell /><div className="text-right text-sm"><p className="font-semibold text-navy-900">{me.nama}</p><p className="text-xs text-slate-500">{me.role}</p></div><span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-navy-600 to-navy-900 text-sm font-bold text-gold-400 shadow">{initial}</span></div>
          </header>
          <main className="p-4 md:p-6"><Outlet /></main>
        </div>
      </div>
    </Ctx.Provider>
  );
}
