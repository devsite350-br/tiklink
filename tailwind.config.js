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
        primary: '#6366f1',    // Indigo 500
        secondary: '#4f46e5',  // Indigo 600 - More blue
        accent: '#8b5cf6',     // Violet 500
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
        'glow': '0 0 20px rgba(99, 102, 241, 0.5)',
        'glow-sm': '0 0 10px rgba(99, 102, 241, 0.3)',
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
