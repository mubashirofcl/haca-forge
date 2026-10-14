/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
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
      },
      borderRadius: {
        card: '18px',
        modal: '28px',
      },
      boxShadow: {
        glass: '0px 20px 40px -15px rgba(0, 0, 0, 0.06), inset 0px 1px 0px rgba(255, 255, 255, 0.95)',
        'glass-hover': '0px 25px 45px -12px rgba(122, 106, 246, 0.12), inset 0px 1px 0px rgba(255, 255, 255, 1)',
        'modal-glass': '0px 30px 60px -15px rgba(0, 0, 0, 0.18), inset 0px 1px 0px rgba(255, 255, 255, 0.9)',
        pill: '0 4px 14px rgba(13, 14, 18, 0.15)',
      },
    },
  },
  plugins: [],
};
