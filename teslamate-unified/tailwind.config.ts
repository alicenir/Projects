import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          raised: "rgb(var(--surface-raised) / <alpha-value>)",
        },
        border: "rgb(var(--border) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
        },
        drive: {
          DEFAULT: "rgb(var(--drive) / <alpha-value>)",
          soft: "rgb(var(--drive-soft) / <alpha-value>)",
        },
        charge: {
          DEFAULT: "rgb(var(--charge) / <alpha-value>)",
          soft: "rgb(var(--charge-soft) / <alpha-value>)",
        },
        battery: {
          DEFAULT: "rgb(var(--battery) / <alpha-value>)",
          soft: "rgb(var(--battery-soft) / <alpha-value>)",
        },
        efficiency: {
          DEFAULT: "rgb(var(--efficiency) / <alpha-value>)",
          soft: "rgb(var(--efficiency-soft) / <alpha-value>)",
        },
        alert: {
          DEFAULT: "rgb(var(--alert) / <alpha-value>)",
          soft: "rgb(var(--alert-soft) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontFeatureSettings: {
        tabular: '"tnum" 1',
      },
      boxShadow: {
        card: "0 1px 0 0 rgb(var(--border) / 0.6), 0 8px 30px -12px rgb(0 0 0 / 0.5)",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "pulse-soft": "pulseSoft 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
