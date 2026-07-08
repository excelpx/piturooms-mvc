/** @type {import('tailwindcss').Config} */
const config = {
  // PENTING: Tentukan folder mana saja yang menggunakan class Tailwind agar terbaca oleh VS Code
  content: [
    "./**/*.{html,js,jsx,ts,tsx,php}", 
    "../**/*.{html,js,jsx,ts,tsx,php}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      }
    }
  },
  plugins: [],
};

// Jembatan ganda: jika dibuka di browser gunakan objek global tailwind.config, jika di NodeJS/VS Code gunakan module.exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = config;
} else {
  window.tailwind = window.tailwind || {};
  window.tailwind.config = config;
}