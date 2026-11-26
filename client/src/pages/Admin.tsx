import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Building2, CalendarClock, ChevronDown, ChevronRight, ClipboardList, FileDown, KeyRound, LayoutDashboard, LogOut, Megaphone, Menu, Moon, PanelLeftClose, PanelLeftOpen, ScrollText, Search, Settings, Sun, UserPlus, Users, X } from 'lucide-react';
import { api } from '../api';
import { Loading, useFetch } from '../ui';
import { useTheme } from '../theme';
import { ChangePassword } from './AdminAuth';
import { NotifBell } from './Notifikasi';

const Ctx = createContext<any>(null);
export const useAuth = () => useContext(Ctx);
type Item = [string, string, any, string | null, string];
const MENU: Item[] = [
  ['/admin', 'Dashboard', LayoutDashboard, null, 'Ikhtisar'], ['/admin/notifikasi', 'Notifikasi', Bell, null, 'Ikhtisar'],
  ['/admin/ormas', 'Data Ormas', Building2, 'view_ormas', 'Organisasi'], ['/admin/pendaftaran', 'Pendaftaran Baru', UserPlus, 'view_ormas', 'Organisasi'], ['/admin/laporan', 'Laporan Tahunan', ClipboardList, 'view_ormas', 'Organisasi'], ['/admin/kedaluwarsa', 'Dokumen Kedaluwarsa', CalendarClock, 'view_ormas', 'Organisasi'], ['/admin/pengumuman', 'Pengumuman', Megaphone, 'view_ormas', 'Organisasi'], ['/admin/password-harian', 'Password Harian', KeyRound, 'view_credentials', 'Organisasi'],
  ['/admin/akun', 'Manajemen Admin', Users, 'manage_admins', 'Sistem'], ['/admin/ekspor', 'Ekspor Data', FileDown, 'export', 'Sistem'], ['/admin/log', 'Log Aktivitas', ScrollText, 'view_logs', 'Sistem'], ['/admin/pengaturan', 'Pengaturan', Settings, 'manage_settings', 'Sistem'],
];
const GROUPS = ['Ikhtisar', 'Organisasi', 'Sistem'];
const COLLAPSE_KEY = 'sidomas_sidebar';

export function AdminShell() {
  const nav = useNavigate(); const { pathname } = useLocation(); const [theme, toggleTheme] = useTheme();
  const [me, setMe] = useState<any>(null); const [open, setOpen] = useState(false); const [menu, setMenu] = useState(false); const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState(() => { try { const v = localStorage.getItem(COLLAPSE_KEY); return v ? v === '1' : window.innerWidth < 1024; } catch { return false; } });
  const menuRef = useRef<HTMLDivElement>(null);
  const load = () => api('/admin/me').then(setMe).catch(() => nav('/admin/login', { replace: true }));
  useEffect(() => { load(); }, []);
  const { data: pc } = useFetch<any>('/admin/pendaftaran/count'); // realtime: jumlah pendaftaran baru
  useEffect(() => { setOpen(false); setMenu(false); window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => {
    if (!open && !menu) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setMenu(false); } };
    const out = (e: MouseEvent) => { if (menu && !menuRef.current?.contains(e.target as Node)) setMenu(false); };
    window.addEventListener('keydown', key); document.addEventListener('mousedown', out);
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('mousedown', out); };
  }, [open, menu]);
  if (!me) return <Loading />;
  if (me.must_change) return <ChangePassword onDone={load} askEmail={String(me.email).endsWith('@sidomas.local')} />;
  const logout = async () => { await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {}); nav('/admin/login'); };
  const items = MENU.filter(([, , , perm]) => !perm || me.perms.includes(perm));
  const here = items.find(([to]) => to === pathname.replace(/\/$/, ''));
  const initial = String(me.nama || '?').trim().charAt(0).toUpperCase();
  const toggleSide = () => setCollapsed((c) => { try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* abaikan */ } return !c; });
  const search = (e: React.FormEvent) => { e.preventDefault(); if (q.trim()) { nav(`/admin/ormas?q=${encodeURIComponent(q.trim())}`); setQ(''); } };
  const hide = collapsed ? 'md:hidden' : '';
  return (
    <Ctx.Provider value={me}>
      <div className="flex min-h-screen">
        {open && <div className="overlay fixed inset-0 z-30 md:hidden" onClick={() => setOpen(false)} />}
        <aside aria-label="Navigasi admin" className={`sidebar fixed inset-y-2 left-2 z-40 flex w-[17rem] shrink-0 flex-col rounded-3xl p-3 transition-[width,transform,visibility] duration-300 md:visible md:sticky md:top-3 md:m-3 md:mr-0 md:h-[calc(100dvh-1.5rem)] md:translate-x-0 ${collapsed ? 'md:w-[4.75rem]' : 'md:w-64'} ${open ? 'visible translate-x-0' : 'invisible -translate-x-[110%]'}`}>
          <div className={`flex items-center gap-3 px-1 pb-4 pt-1 ${collapsed ? 'md:justify-center md:px-0' : ''}`}>
            <span className="brand-mark h-10 w-10"><Building2 size={19} /></span>
            <span className={`min-w-0 flex-1 ${hide}`}><span className="block text-[15px] font-extrabold leading-tight tracking-[.08em] text-ink">SIDOMAS</span><span className="eyebrow block !text-[9.5px] !tracking-[.14em]">Bidang Poldagri</span></span>
            <button type="button" className="icon-btn md:!hidden" aria-label="Tutup menu" onClick={() => setOpen(false)}><X size={17} /></button>
          </div>
          <nav className="-mx-1 flex-1 overflow-y-auto overflow-x-hidden px-1">
            {GROUPS.map((g) => { const list = items.filter((i) => i[4] === g); return !list.length ? null : (
              <div key={g} className="mb-3">
                <p className={`mb-1 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-muted/70 ${hide}`}>{g}</p>
                {collapsed && <span className="mx-auto mb-2 hidden h-px w-6 bg-gold/30 md:block" />}
                <div className="space-y-0.5">{list.map(([to, label, Icon]) => { const n = to === '/admin/pendaftaran' ? pc?.count : 0; return (
                  <NavLink key={to} to={to} end={to === '/admin'} title={label} aria-label={n ? `${label}, ${n} baru` : label} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${collapsed ? 'md:justify-center md:px-0' : ''}`}>
                    <Icon size={18} strokeWidth={1.8} />
                    <span className={`flex-1 truncate ${hide}`}>{label}</span>
                    {n ? <span className={`rounded-full bg-gold px-1.5 text-[10.5px] font-bold leading-5 text-navy-night ${collapsed ? 'md:absolute md:right-1 md:top-0 md:leading-4' : ''}`}>{n}</span> : null}
                  </NavLink>); })}</div>
              </div>); })}
          </nav>
          <div className="space-y-0.5 border-t border-line pt-2">
            <button type="button" onClick={toggleSide} className={`nav-item hidden w-full md:flex ${collapsed ? 'justify-center !px-0' : ''}`} title={collapsed ? 'Lebarkan menu' : 'Ciutkan menu'} aria-label={collapsed ? 'Lebarkan menu' : 'Ciutkan menu'}>
              {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.8} /> : <><PanelLeftClose size={18} strokeWidth={1.8} /> Ciutkan menu</>}
            </button>
            <button type="button" onClick={logout} className={`nav-item w-full hover:!text-bad ${collapsed ? 'md:justify-center md:px-0' : ''}`} title="Logout" aria-label="Logout"><LogOut size={18} strokeWidth={1.8} /><span className={hide}>Logout</span></button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-20 px-3 pt-3 md:px-5">
            <header className="topbar flex items-center gap-2 rounded-2xl px-2.5 py-2 sm:gap-3 sm:px-3">
              <button type="button" className="icon-btn md:!hidden" aria-label="Buka menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={18} /></button>
              <div className="min-w-0 flex-1 pl-1">
                <p className="hidden items-center gap-1 text-[11px] text-muted sm:flex">Admin <ChevronRight size={11} /> {here?.[4] || 'Halaman'}</p>
                <p className="truncate text-sm font-bold text-ink">{here?.[1] || 'SIDOMAS'}</p>
              </div>
              {me.perms.includes('view_ormas') && (
                <form onSubmit={search} role="search" className="relative hidden w-56 lg:block xl:w-80">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input className="inp !min-h-0 !py-1.5 pl-9" placeholder="Cari ormas, lalu tekan Enter" aria-label="Cari ormas di seluruh data" value={q} onChange={(e) => setQ(e.target.value)} />
                </form>
              )}
              <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Pakai tema terang' : 'Pakai tema gelap'} title={theme === 'dark' ? 'Tema terang' : 'Tema gelap'}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
              <NotifBell />
              <div className="relative" ref={menuRef}>
                <button type="button" className="flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-soft/60" aria-haspopup="true" aria-expanded={menu} aria-label="Menu profil" onClick={() => setMenu(!menu)}>
                  <span className="brand-mark h-8 w-8 !rounded-full text-[13px] font-extrabold">{initial}</span>
                  <span className="hidden max-w-[10rem] text-left leading-tight xl:block"><span className="block truncate text-[13px] font-semibold text-ink">{me.nama}</span><span className="block truncate text-[11px] text-muted">{me.role}</span></span>
                  <ChevronDown size={14} className="hidden text-muted sm:block" />
                </button>
                {menu && (
                  <div className="popover absolute right-0 top-full z-50 mt-3 w-64 p-2">
                    <div className="border-b border-line px-3 pb-3 pt-1.5"><p className="font-semibold text-ink">{me.nama}</p><p className="text-xs text-muted">{me.role}</p><p className="mt-0.5 truncate text-xs text-muted">{me.email}</p></div>
                    <button type="button" className="nav-item mt-1 w-full" onClick={toggleTheme}>{theme === 'dark' ? <><Sun size={17} /> Tema terang</> : <><Moon size={17} /> Tema gelap</>}</button>
                    <button type="button" className="nav-item w-full hover:!text-bad" onClick={logout}><LogOut size={17} /> Logout</button>
                  </div>
                )}
              </div>
            </header>
          </div>
          <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-5 md:px-5"><div key={pathname} className="anim-fade-up"><Outlet /></div></main>
        </div>
      </div>
    </Ctx.Provider>
  );
}
