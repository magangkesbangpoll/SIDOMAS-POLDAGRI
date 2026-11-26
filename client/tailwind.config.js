// Token warna disimpan sebagai variabel CSS (lihat src/index.css) agar satu kelas berlaku di tema gelap dan terang.
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: {
      bg: v('bg'), surface: v('surface'), raised: v('raised'), soft: v('soft'), line: 'var(--line)',
      ink: v('ink'), body: v('body'), muted: v('muted'), link: v('link'),
      gold: { DEFAULT: v('gold'), soft: v('gold-soft') }, navy: { DEFAULT: '#172338', deep: '#111B2D', night: '#0B1120' },
      ok: v('ok'), warn: v('warn'), bad: v('bad'), info: v('info'),
    },
    fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'Segoe UI', 'sans-serif'], serif: ['Fraunces', 'Georgia', 'serif'] },
  } },
  plugins: [],
};
