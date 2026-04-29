import type { Config } from 'tailwindcss';

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: '#07111f',
        panel: '#0f1b2d',
        panelSoft: '#15243b',
        accent: '#4dd7b0',
        accentAlt: '#8dd9ff',
        caution: '#ffca7a',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(77, 215, 176, 0.2), 0 24px 80px rgba(0, 0, 0, 0.35)',
      },
      backgroundImage: {
        'radial-sheen': 'radial-gradient(circle at top, rgba(77, 215, 176, 0.22), transparent 35%), radial-gradient(circle at 80% 0%, rgba(141, 217, 255, 0.18), transparent 30%), linear-gradient(180deg, rgba(7, 17, 31, 0.96), rgba(6, 12, 22, 1))',
      },
    },
  },
  plugins: [],
};

export default config;
