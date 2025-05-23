// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontSize: {
        '18': '1.125rem',
      },
      lineHeight: {
        '125': '1.25',
      },
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
        // Keep the keyframes the same, the gradient color is controlled in the component
        shimmer: {
          '0%': { transform: 'translateX(-100%)' }, // Use transform for potentially smoother animation
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 2.3s ease-out forwards',
        slideUp: 'slideUp 1s ease-in forwards',
        bounceSlow: 'bounceSlow 2s infinite',
        slideLeftSmall: 'slideLeftSmall 0.4s ease',
        slideRightSmall: 'slideRightSmall 0.4s ease',
        // Adjusted shimmer duration slightly if needed, 1.5s is usually good
        shimmer: 'shimmer 1.5s infinite linear',
      },
    },
  },
  plugins: [],
};