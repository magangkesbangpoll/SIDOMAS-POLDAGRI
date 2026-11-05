export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { navy: { 50: '#eef3fb', 100: '#d9e4f5', 600: '#1d4a94', 700: '#143a7a', 800: '#0f2f66', 900: '#0b2250' }, gold: { 400: '#d9b44a', 500: '#c9a227', 600: '#a8861c' } },
    fontFamily: { sans: ['"Source Sans 3"', 'system-ui', 'Segoe UI', 'sans-serif'], serif: ['"Source Serif 4"', 'Georgia', 'serif'] },
  } },
  plugins: [],
};
