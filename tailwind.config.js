/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Orbitron", "Space Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
        script: ["Great Vibes", "Dancing Script", "cursive"],
      },
    },
  },
  plugins: [],
};
