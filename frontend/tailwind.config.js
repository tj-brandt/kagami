// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Enable dark mode based on a 'dark' class on the HTML element
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // --- Colors ---
      colors: {
        // Light Mode Palette (Default)
        'brand-primary': '#050067', // Dark Blue
        'brand-secondary': '#ffbb00', // Dark Yellow
        'brand-accent': '#ffd0e5', // Pink
        'brand-neutral': '#997d8a', // Mauve Taupe
        'text-dark': '#717171',    // Dark Grey for text
        'text-light': '#fcfcfc',   // Lightest Grey for text on dark backgrounds
        'bg-light': '#fcfcfc',     // Lightest Grey for primary background
        'bg-surface-light': '#ffefc5', // Cream for cards/surfaces in light mode
        'border-light': '#e5e5e5',   // Grey for borders in light mode

        // Dark Mode Palette (Complementary interpretation)
        // These will be used with the 'dark:' prefix
        'dark-bg': '#050067',        // Dark Blue for primary background in dark mode
        'dark-surface': '#1A1B4B',   // A slightly lighter dark blue for surfaces
        'dark-text': '#ffefc5',      // Cream for text in dark mode
        'dark-border': '#717171',    // Dark Grey for borders in dark mode
        'dark-accent': '#ffd0e5',    // Pink (can remain the same or be adjusted if needed)
        'dark-secondary': '#ffbb00', // Dark Yellow (can remain the same)
      },

      // --- Font Family ---
      fontFamily: {
        sans: ['"Zen Maru Gothic"', 'sans-serif'],
      },

      // --- Border Radius ---
      borderRadius: {
        'medium': '25px',
        'large': '50px'
      },

      // --- Border Widths ---
      borderWidth: {
        'button': '3px',   // Custom for button borders
        'div-sm': '5px',   // Custom for small div borders
        'div-md': '10px',  // Custom for medium div borders
      },

      // --- Keyframes & Animations (kept from your existing config, good for motion) ---
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(450px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        bounceSlow: {
          '0%, 100%': {
            transform: 'translateY(0)',
          },
          '50%': {
            transform: 'translateY(-10px)',
          },
        },
        slideLeftSmall: {
          '0%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(-10px)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideRightSmall: {
          '0%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(10px)' },
          '100%': { transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 2.3s ease-out forwards',
        slideUp: 'slideUp 1s ease-in forwards',
        bounceSlow: 'bounceSlow 2s infinite',
        slideLeftSmall: 'slideLeftSmall 0.4s ease',
        slideRightSmall: 'slideRightSmall 0.4s ease',
        shimmer: 'shimmer 1.5s infinite linear',
      },
    },
  },
  plugins: [],
};