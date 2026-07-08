import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1A1508',        // warm black — matches the dark logo treatment
        road: '#FBF8F0',       // warm off-white page background
        marigold: '#E7AF24',   // brand gold — sampled from the Sahyatri logo
        marigoldDeep: '#B8880F',
        teal: '#0E7C66',       // verified / KYC-approved states
        signal: '#C93B2E',     // alerts & destructive actions
        line: '#EAE2CF',
      },
      fontFamily: {
        display: ['"Ancorli"', '"Poppins"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: { card: '0 1px 3px rgba(26,21,8,0.08), 0 8px 24px rgba(26,21,8,0.06)' },
    },
  },
  plugins: [],
};
export default config;
