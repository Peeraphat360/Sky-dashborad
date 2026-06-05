/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sky: {
          50: '#f0f7ff',
          100: '#e0efff',
          200: '#baddff',
          300: '#7dc0ff',
          400: '#389af8',
          500: '#0e7be8',
          600: '#0261c7',
          700: '#034da1',
          800: '#073f84',
          900: '#0c356d',
          950: '#08204a',
        }
      },
      fontFamily: {
        sans: ['IBM Plex Sans Thai', 'IBM Plex Sans', 'sans-serif'],
        display: ['Sarabun', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
