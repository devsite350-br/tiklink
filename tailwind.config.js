/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2f8f74',    // Brand teal
        secondary: '#256f5a',  // Brand teal (darker)
        accent: '#234a63',     // Brand navy (logo gradient end)
        'base-100': '#FFFFFF',
        'base-200': '#F1F5F9', // Slate 100
        'base-300': '#E2E8F0', // Slate 200
        'base-content': '#0F172A', // Slate 900
        'base-content-subtle': '#64748B', // Slate 500

        // Dark mode equivalents (simulated for custom names if needed, or used directly)
        'base-700': '#334155', // Slate 700
        'base-800': '#1e293b', // Slate 800
        'base-900': '#0f172a', // Slate 900
        'base-950': '#020617', // Slate 950

        success: '#10b981',    // Emerald 500
        warning: '#f59e0b',    // Amber 500
        error: '#ef4444',      // Red 500
      },
      fontFamily: {
        sans: ['Rubik', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(47, 143, 116, 0.5)',
        'glow-sm': '0 0 10px rgba(47, 143, 116, 0.3)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
