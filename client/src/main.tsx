import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import './inputfilter'; // filter input otomatis di semua form
import { ToastProvider } from './ui';
import { ThemeSync } from './theme';
import { About, Catalog, OrmasPublic } from './pages/Public';
import { Home, PublicLayout } from './pages/Landing';
import { AdminShell } from './pages/Admin';
import { Forgot, Login, Reset } from './pages/AdminAuth';
import { PortalForgot, PortalHome, PortalLogin, PortalReset } from './pages/Portal';
import { PortalDashboard } from './pages/PortalDashboard';
import { PortalLaporan } from './pages/PortalLaporan';
import { OrmasPage } from './pages/AdminOrmas';
import { Dashboard } from './pages/Dashboard';
import { Daftar } from './pages/Daftar';
import { AdminLaporanPage } from './pages/AdminLaporan';
import { AdminPengumumanPage } from './pages/AdminPengumuman';
import { PendaftaranPage } from './pages/AdminPendaftaran';
import { TrackingPage } from './pages/Tracking';
import { ExpiredPage, NotifPage } from './pages/Notifikasi';
import { AdminsPage, ExportPage, LogsPage, SettingsPage } from './pages/AdminMore';

// Service worker untuk notifikasi HP admin (hanya jalan di HTTPS atau localhost)
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <ThemeSync />
    <ToastProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="katalog" element={<Catalog />} />
          <Route path="tentang" element={<About />} />
          <Route path="daftar" element={<Daftar />} />
          <Route path="tracking" element={<TrackingPage />} />
          <Route path="ormas/:kode" element={<OrmasPublic />} />
        </Route>
        <Route path="ormas-login" element={<PortalLogin />} />
        <Route path="ormas-login/lupa" element={<PortalForgot />} />
        <Route path="ormas-login/reset" element={<PortalReset />} />
        <Route path="portal" element={<PortalDashboard />} />
        <Route path="portal/dashboard" element={<PortalDashboard />} />
        <Route path="portal/data" element={<PortalHome />} />
        <Route path="portal/laporan" element={<PortalLaporan />} />
        <Route path="admin/login" element={<Login />} />
        <Route path="admin/forgot" element={<Forgot />} />
        <Route path="admin/reset" element={<Reset />} />
        <Route path="admin" element={<AdminShell />}>
          <Route index element={<Dashboard />} />
          <Route path="ormas" element={<OrmasPage />} />
          <Route path="laporan" element={<AdminLaporanPage />} />
          <Route path="pengumuman" element={<AdminPengumumanPage />} />
          <Route path="pendaftaran" element={<PendaftaranPage />} />
          <Route path="kedaluwarsa" element={<ExpiredPage />} />
          <Route path="notifikasi" element={<NotifPage />} />
          <Route path="akun" element={<AdminsPage />} />
          <Route path="ekspor" element={<ExportPage />} />
          <Route path="log" element={<LogsPage />} />
          <Route path="pengaturan" element={<SettingsPage />} />
        </Route>
      </Routes>
    </ToastProvider>
  </BrowserRouter>,
);
