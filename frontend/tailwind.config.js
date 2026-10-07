/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        petrol: {
          50: '#f2f8f8',
          100: '#e3f4f1',
          200: '#bfe7e1',
          700: '#155b6e',
          800: '#0e4a5c',
          900: '#0f2e3d',
          950: '#0d2836',
        },
        mint: {
          50: '#f5faf9',
          100: '#e4f3f0',
          200: '#ccede7',
          400: '#2dd4bf',
          500: '#14b8a6',
        },
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
        }
      }
    },
  },
  plugins: [],
}
