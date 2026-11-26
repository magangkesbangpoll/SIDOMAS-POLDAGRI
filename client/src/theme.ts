import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export type Theme = 'dark' | 'light';
const KEY = 'sidomas_theme';
const EVT = 'sidomas-theme';
const read = (): Theme => { try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } };
let current: Theme = read();

// Preferensi tampilan area kerja (admin & portal). Hanya disimpan di browser ini.
export function useTheme(): [Theme, () => void] {
  const [t, setT] = useState<Theme>(current);
  useEffect(() => { const h = () => setT(current); window.addEventListener(EVT, h); return () => window.removeEventListener(EVT, h); }, []);
  const toggle = () => { current = current === 'dark' ? 'light' : 'dark'; try { localStorage.setItem(KEY, current); } catch { /* abaikan */ } window.dispatchEvent(new Event(EVT)); };
  return [t, toggle];
}

// Halaman publik selalu terang, halaman login selalu sinematik gelap, area kerja mengikuti pilihan pengguna.
export function ThemeSync() {
  const { pathname } = useLocation(); const [t] = useTheme();
  useEffect(() => {
    const auth = /^\/(admin\/(login|forgot|reset)|ormas-login)/.test(pathname);
    const work = /^\/(admin|portal)(\/|$)/.test(pathname);
    const theme: Theme = auth ? 'dark' : work ? t : 'light';
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0B1120' : '#F4F6F9');
  }, [pathname, t]);
  return null;
}
