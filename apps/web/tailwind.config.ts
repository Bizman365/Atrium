import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pexlo: {
          terracotta: "#C85A38",
          "terracotta-deep": "#A85436",
          accent: "#D63E1F",
          paper: "#FAFAF7",
          ink: "#1A1A1A",
          "ink-soft": "#6B6B6B",
          hairline: "#E5E0D8",
        },
      },
      fontFamily: {
        serif: ["var(--font-pexlo-serif)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
