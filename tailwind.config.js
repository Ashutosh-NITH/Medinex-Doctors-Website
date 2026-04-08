/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#199a8e',
        primaryDark: '#147b72',
      },
    },
  },
  plugins: [],
}