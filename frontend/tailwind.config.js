/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontSize: {
        '18': '1.125rem'
      },
      lineHeight: {
        '125': '1.25'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },  // Starting with slight scale down and opacity 0
          '100%': { opacity: '1', transform: 'scale(1)' },  // Final state with full opacity and normal scale
        },
      },
      animation: {
        fadeIn: 'fadeIn 2.3s ease-out forwards',  // Applying the fadeIn animation
      },
    }
  },
  plugins: [],
}
