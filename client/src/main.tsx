import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { ToastProvider } from './ui';
import { About, Catalog, Home, OrmasPublic, PublicLayout } from './pages/Public';
import { AdminShell } from './pages/Admin';
import { Forgot, Login, Reset } from './pages/AdminAuth';
import { PortalForgot, PortalHome, PortalLogin, PortalReset } from './pages/Portal';
import { Dashboard, OrmasPage } from './pages/AdminOrmas';
import { AdminsPage, CredentialsPage, ExportPage, LogsPage, SettingsPage } from './pages/AdminMore';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <ToastProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="katalog" element={<Catalog />} />
          <Route path="tentang" element={<About />} />
          <Route path="ormas/:kode" element={<OrmasPublic />} />
        </Route>
        <Route path="ormas-login" element={<PortalLogin />} />
        <Route path="ormas-login/lupa" element={<PortalForgot />} />
        <Route path="ormas-login/reset" element={<PortalReset />} />
        <Route path="portal" element={<PortalHome />} />
        <Route path="admin/login" element={<Login />} />
        <Route path="admin/forgot" element={<Forgot />} />
        <Route path="admin/reset" element={<Reset />} />
        <Route path="admin" element={<AdminShell />}>
          <Route index element={<Dashboard />} />
          <Route path="ormas" element={<OrmasPage />} />
          <Route path="password-harian" element={<CredentialsPage />} />
          <Route path="akun" element={<AdminsPage />} />
          <Route path="ekspor" element={<ExportPage />} />
          <Route path="log" element={<LogsPage />} />
          <Route path="pengaturan" element={<SettingsPage />} />
        </Route>
      </Routes>
    </ToastProvider>
  </BrowserRouter>,
);
