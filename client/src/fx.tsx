import React, { useEffect, useRef, useState } from 'react';

// Konten muncul dengan animasi saat masuk ke layar (scroll)
export function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${on ? 'in' : ''} ${className}`} style={{ '--d': `${delay}s` } as React.CSSProperties}>{children}</div>;
}

// Angka berhitung naik dari 0 sampai nilai akhir
export function CountUp({ value, duration = 1200 }: { value: number | string | null | undefined; duration?: number }) {
  const target = value == null || value === '' ? null : Number(value);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (target == null || Number.isNaN(target)) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return <>{target == null || Number.isNaN(target) ? '–' : n.toLocaleString('id-ID')}</>;
}

// Jam berjalan (WIB). State dipisah di komponen ini agar halaman lain tidak ikut dirender tiap detik.
const JAM = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export function LiveClock({ className = '' }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    // dijadwalkan tepat di pergantian detik supaya tidak melompat
    const tick = () => { setNow(new Date()); t = setTimeout(tick, 1000 - (Date.now() % 1000) + 5); };
    tick();
    return () => clearTimeout(t);
  }, []);
  const teks = JAM.format(now);
  return (
    <div className={`clock ${className}`}>
      <span className="live-dot" aria-hidden="true" />
      <time dateTime={now.toISOString()} aria-label={`Jam ${teks} WIB`} className="clock-digits">
        {teks.split('').map((c, i) => (c === ':' ? <span key={i} aria-hidden="true" className="clock-sep">:</span> : <span key={`${i}-${c}`} aria-hidden="true" className="clock-num">{c}</span>))}
      </time>
      <span className="eyebrow">WIB</span>
    </div>
  );
}
