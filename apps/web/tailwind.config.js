/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Plus Jakarta Sans is loaded by the Google Fonts link in index.html (300–800).
      // Before this, `font-sans` on <body> resolved to Tailwind's system stack and the
      // `body { font-family }` rule in index.css never applied.
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
      },
      colors: {
        canvas: {
          start: '#f3f5f9',
          mid: '#eef1f8',
          end: '#e8ecf4',
        },
        brand: {
          purple: '#7a6af6',
          indigo: '#4f46e5',
          dark: '#0d0e12',
          light: '#f8fafc',
        },
        text: {
          primary: '#111827',
          secondary: '#6b7280',
          muted: '#9ca3af',
        },
        // Retheme tokens (defined in src/index.css :root)
        ui: {
          canvas: 'rgb(var(--ui-canvas-rgb) / <alpha-value>)',
          'canvas-deep': 'rgb(var(--ui-canvas-deep-rgb) / <alpha-value>)',
          panel: 'var(--ui-panel)',
          'panel-border': 'var(--ui-panel-border)',
          card: 'rgb(var(--ui-card-rgb) / <alpha-value>)',
          'card-hover': 'rgb(var(--ui-card-hover-rgb) / <alpha-value>)',
          line: 'var(--ui-line)',
          ink: 'rgb(var(--ui-ink-rgb) / <alpha-value>)',
          text: 'rgb(var(--ui-text-rgb) / <alpha-value>)',
          muted: 'rgb(var(--ui-muted-rgb) / <alpha-value>)',
          blue: 'rgb(var(--ui-blue-rgb) / <alpha-value>)',
          'blue-soft': 'rgb(var(--ui-blue-soft-rgb) / <alpha-value>)',
          coral: 'rgb(var(--ui-coral-rgb) / <alpha-value>)',
          'coral-soft': 'rgb(var(--ui-coral-soft-rgb) / <alpha-value>)',
        },
      },
      borderRadius: {
        card: '18px',
        modal: '28px',
        'ui-panel': 'var(--ui-radius-panel)',
        'ui-card': 'var(--ui-radius-card)',
        'ui-control': 'var(--ui-radius-control)',
      },
      boxShadow: {
        'ui-panel': 'var(--ui-shadow-panel)',
        'ui-card': 'var(--ui-shadow-card)',
        'ui-modal': 'var(--ui-shadow-modal)',
        glass: '0px 20px 40px -15px rgba(0, 0, 0, 0.06), inset 0px 1px 0px rgba(255, 255, 255, 0.95)',
        'glass-hover': '0px 25px 45px -12px rgba(122, 106, 246, 0.12), inset 0px 1px 0px rgba(255, 255, 255, 1)',
        'modal-glass': '0px 30px 60px -15px rgba(0, 0, 0, 0.18), inset 0px 1px 0px rgba(255, 255, 255, 0.9)',
        pill: '0 4px 14px rgba(13, 14, 18, 0.15)',
      },
    },
  },
  plugins: [],
};
