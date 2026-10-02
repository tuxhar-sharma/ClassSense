/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bpit: {
          navy: '#162456',
          navyHover: '#101a40',
          navyLight: '#eef2ff',
          maroon: '#991b1b',
          maroonLight: '#fee2e2',
          green: '#16a34a',
          greenBg: '#dcfce7',
          greenText: '#15803d',
          amber: '#d97706',
          amberBg: '#fef3c7',
          amberText: '#b45309',
          canvas: '#f8fafc',
          card: '#ffffff',
          border: '#e2e8f0',
          muted: '#64748b'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'card': '12px',
        'btn': '8px',
      }
    },
  },
  plugins: [],
}
