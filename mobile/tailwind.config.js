/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  // NativeWind v4 ships its own preset that wires the React Native renderer.
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Risk palette — keep in sync with mobile/lib/a11y.ts riskPalette.
        risk: {
          red: '#dc2626',
          'red-bg': '#fee2e2',
          yellow: '#d97706',
          'yellow-bg': '#fef3c7',
          green: '#16a34a',
          'green-bg': '#dcfce7',
        },
      },
      fontSize: {
        // Elderly-friendly floors — every screen MUST honour these.
        body: ['16px', '24px'],
        h2: ['20px', '28px'],
        h1: ['24px', '32px'],
      },
      minHeight: {
        // Minimum 56dp touch target across the app.
        touch: '56px',
        row: '64px',
      },
      minWidth: {
        touch: '56px',
      },
    },
  },
  plugins: [],
};
