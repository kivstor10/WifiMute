/** @type {import('tailwindcss').Config} */
module.exports = {
  // CRITICAL FIX: Ensure all file types, especially .tsx and .jsx, are scanned.
  content: [
    "./index.html",
    // This is the essential line for React/TypeScript/Vite projects:
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
