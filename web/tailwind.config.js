/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d17",
        card: "#111425",
        card2: "#161a30",
        border: "rgba(79,142,247,.15)",
        muted: "#5c6490",
        acc: "#4f8ef7",
      },
    },
  },
  plugins: [],
};
