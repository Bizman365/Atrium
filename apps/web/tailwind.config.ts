import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pexlo: {
          terracotta: "var(--pexlo-terracotta)",
          "terracotta-deep": "var(--pexlo-terracotta-deep)",
          "terracotta-subtle": "var(--pexlo-terracotta-subtle)",
          accent: "var(--pexlo-accent)",
          paper: "var(--pexlo-paper)",
          panel: "var(--pexlo-panel)",
          ink: "var(--pexlo-ink)",
          "ink-soft": "var(--pexlo-ink-soft)",
          hairline: "var(--pexlo-hairline)",
          "hairline-soft": "var(--pexlo-hairline-soft)",
          "on-terracotta": "var(--pexlo-on-terracotta)",
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
