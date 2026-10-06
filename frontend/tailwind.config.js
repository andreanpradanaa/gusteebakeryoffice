/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cream: { 50: '#FFFBF4', 100: '#FFF6E9', 200: '#FBEAD2', 300: '#F3D9B5' },
        crust: { 300: '#D9A066', 400: '#C68642', 500: '#A8692F', 600: '#8B5A2B', 700: '#6B4423', 800: '#4A2F1A', 900: '#2E1D10' },
        peach: { 100: '#FFE8DC', 200: '#FFD2BC', 300: '#FFB89A', 400: '#F59A78' },
        mint: { 100: '#E3F4E8', 200: '#C9EBD3', 300: '#B8E0C2', 400: '#8CCB9E', 500: '#5FAE78' },
        night: { 700: '#2A2233', 800: '#1E1826', 900: '#15111B' },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        pixel: '4px 4px 0 0 rgba(74,47,26,0.35)',
      },
    },
  },
  plugins: [],
};
