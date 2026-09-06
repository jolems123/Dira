import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0B2342',
        brand: {
          50: '#f4f7fb',
          100: '#e9eef7',
          500: '#0b2342',
          600: '#071d36',
        },
        green: '#0f9f73',
        amber: '#d97706',
        red: '#dc2626',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(11,35,66,0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
