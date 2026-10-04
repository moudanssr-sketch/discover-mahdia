import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#07111f",
        navy: "#0c1d35",
        ink: "#101827",
        gold: "#d9ad4f",
        brass: "#a97828",
        ivory: "#f5f0df",
        lagoon: "#1ea7a8",
        coral: "#e26352"
      },
      fontFamily: {
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 34px rgba(217, 173, 79, 0.26)",
        glass: "0 24px 80px rgba(0, 0, 0, 0.28)"
      },
      backgroundImage: {
        "museum-grid":
          "linear-gradient(rgba(217,173,79,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(217,173,79,.08) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
} satisfies Config;
