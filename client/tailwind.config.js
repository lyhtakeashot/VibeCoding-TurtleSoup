/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#070b18',
          800: '#0b1224',
          700: '#111a33',
          600: '#1a2547',
        },
        neon: {
          cyan: '#38f5e0',
          purple: '#a487ff',
          pink: '#ff6ad5',
        },
        answer: {
          yes: '#34d399',
          no: '#f87171',
          irrel: '#fbbf24',
          partial: '#60a5fa',
        },
      },
      fontFamily: {
        display: ['"Noto Serif SC"', 'serif'],
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(56,245,224,0.25)',
        'glow-purple': '0 0 24px rgba(164,135,255,0.3)',
      },
      backgroundImage: {
        'ink-gradient':
          'radial-gradient(1200px 600px at 20% -10%, rgba(164,135,255,0.18), transparent), radial-gradient(900px 500px at 100% 0%, rgba(56,245,224,0.14), transparent), linear-gradient(180deg, #070b18, #0b1224)',
      },
      keyframes: {
        pulseNode: {
          '0%,100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.08)', opacity: '0.85' },
        },
        floatIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        pulseNode: 'pulseNode 2.4s ease-in-out infinite',
        floatIn: 'floatIn 0.35s ease-out',
      },
    },
  },
  plugins: [],
};
