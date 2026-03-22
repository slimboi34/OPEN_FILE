/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0d',
        surface: '#121216',
        surfaceHover: '#1c1c22',
        primary: '#3b82f6',
        accent: '#8b5cf6',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
}
