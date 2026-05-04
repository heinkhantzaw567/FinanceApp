/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        slate: '#334155',
        charge: '#ef4444',
        refund: '#22c55e',
      },
      boxShadow: {
        glow: '0 15px 35px -15px rgba(9, 94, 88, 0.4)',
      },
    },
  },
  plugins: [],
}

