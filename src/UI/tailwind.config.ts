import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        primary: {
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
        },
        accent: {
          50:  "#ecfeff",
          100: "#cffafe",
          500: "#06b6d4",
          600: "#0891b2",
        },
        sidebar: "#0f172a",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        bounce3: {
          "0%,80%,100%": { transform: "translateY(0)" },
          "40%":          { transform: "translateY(-6px)" },
        },
        pulse2: {
          "0%,100%": { opacity: "1" },
          "50%":     { opacity: "0.4" },
        },
        progressPulse: {
          "0%":   { transform: "translateX(-100%)" },
          "50%":  { transform: "translateX(0%)" },
          "100%": { transform: "translateX(100%)" },
        },
        progressSlide: {
          "0%":   { marginLeft: "-70%", width: "70%" },
          "100%": { marginLeft: "100%", width: "70%" },
        },
      },
      animation: {
        "fade-in":  "fade-in 0.3s ease both",
        "slide-up": "slide-up 0.25s ease both",
        "bounce3":  "bounce3 1.1s infinite",
        "pulse2":   "pulse2 1.2s ease infinite",
      },
    },
  },
  plugins: [],
};

export default config;
