import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Driven at runtime from the ?color= URL param via CSS variables.
        brand: {
          DEFAULT: "var(--brand)",
          fg: "var(--brand-fg)",
          soft: "var(--brand-soft)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
