/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold:    { DEFAULT: '#D4AF37', dim: 'rgba(212,175,55,0.12)', border: 'rgba(212,175,55,0.25)' },
        teal:    { DEFAULT: '#14B8A6', dim: 'rgba(20,184,166,0.10)' },
        orange:  { DEFAULT: '#EC5B13' },
        base:    '#0A0F1E',
        surface: '#111827',
        card:    'rgba(255,255,255,0.04)',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      borderRadius: { pill: '9999px' },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'pulse-gold': { '0%,100%': { boxShadow: '0 0 0 0 rgba(212,175,55,0.4)' }, '50%': { boxShadow: '0 0 24px 8px rgba(212,175,55,0.15)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease forwards',
        'pulse-gold': 'pulse-gold 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

