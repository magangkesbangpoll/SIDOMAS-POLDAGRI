import React, { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, Building2, CalendarClock, FileDown, KeyRound, LayoutDashboard, LogOut, Menu, ScrollText, Settings, Users } from 'lucide-react';
import { api } from '../api';
import { ChangePassword } from './AdminAuth';
import { NotifBell } from './Notifikasi';

const Ctx = createContext<any>(null);
export const useAuth = () => useContext(Ctx);
const MENU: [string, string, any, string | null][] = [
  ['/admin', 'Dashboard', LayoutDashboard, null], ['/admin/ormas', 'Data Ormas', Building2, 'view_ormas'], ['/admin/kedaluwarsa', 'Dokumen Kedaluwarsa', CalendarClock, 'view_ormas'], ['/admin/notifikasi', 'Notifikasi', Bell, null], ['/admin/password-harian', 'Password Harian', KeyRound, 'view_credentials'],
  ['/admin/akun', 'Manajemen Admin', Users, 'manage_admins'], ['/admin/ekspor', 'Ekspor Data', FileDown, 'export'], ['/admin/log', 'Log Aktivitas', ScrollText, 'view_logs'], ['/admin/pengaturan', 'Pengaturan', Settings, 'manage_settings'],
];

export function AdminShell() {
  const nav = useNavigate(); const [me, setMe] = useState<any>(null); const [collapsed, setCollapsed] = useState(false); const [open, setOpen] = useState(false);
  const load = () => api('/admin/me').then(setMe).catch(() => nav('/admin/login', { replace: true }));
  useEffect(() => { load(); }, []);
  if (!me) return <div className="grid min-h-screen place-items-center text-slate-500">Memuat…</div>;
  if (me.must_change) return <ChangePassword onDone={load} askEmail={String(me.email).endsWith('@sidomas.local')} />;
  const logout = async () => { await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {}); nav('/admin/login'); };
  const items = MENU.filter(([, , , perm]) => !perm || me.perms.includes(perm));
  const link = ({ isActive }: any) => `flex items-center gap-3 rounded px-3 py-2 text-sm font-semibold ${isActive ? 'bg-gold-500 text-navy-900' : 'text-navy-100 hover:bg-navy-700'}`;
  return (
    <Ctx.Provider value={me}>
      <div className="flex min-h-screen">
        {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}
        <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-navy-900 p-3 transition-all md:static ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${collapsed ? 'md:w-16' : 'md:w-60'} w-60`}>
          <div className="mb-4 flex items-center gap-2 px-2 py-2 text-white"><Building2 className="shrink-0 text-gold-400" />{!collapsed && <span className="font-serif text-lg font-bold">SIDOMAS</span>}</div>
          <nav className="flex-1 space-y-1">{items.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/admin'} className={link} onClick={() => setOpen(false)} title={label}><Icon size={18} className="shrink-0" />{!collapsed && label}</NavLink>)}</nav>
          <button onClick={logout} className="flex items-center gap-3 rounded px-3 py-2 text-sm font-semibold text-navy-100 hover:bg-navy-700" title="Logout"><LogOut size={18} className="shrink-0" />{!collapsed && 'Logout'}</button>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <button className="btn-o px-2" aria-label="Menu" onClick={() => (window.innerWidth < 768 ? setOpen(!open) : setCollapsed(!collapsed))}><Menu size={18} /></button>
            <div className="flex items-center gap-3"><NotifBell /><div className="text-right text-sm"><p className="font-semibold text-navy-900">{me.nama}</p><p className="text-xs text-slate-500">{me.role}</p></div></div>
          </header>
          <main className="p-4 md:p-6"><Outlet /></main>
        </div>
      </div>
    </Ctx.Provider>
  );
}
