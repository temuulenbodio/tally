import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "pixel-bg": "#0d0d1a",
        "pixel-panel": "#16213e",
        "pixel-card": "#1a1a2e",
        "pixel-green": "#00ff41",
        "pixel-yellow": "#ffdd00",
        "pixel-pink": "#ff0080",
        "pixel-blue": "#00d4ff",
        "pixel-orange": "#ff6b35",
        "pixel-purple": "#9b59b6",
        "pixel-border": "#2a2a5e",
      },
      fontFamily: {
        pixel: ["'Press Start 2P'", "cursive"],
      },
      animation: {
        blink: "blink 1s step-end infinite",
        "drink-pop": "drinkPop 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97)",
        "slide-up": "slideUp 0.3s ease-out",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        drinkPop: {
          "0%": { transform: "scale(1)" },
          "30%": { transform: "scale(0.88)" },
          "60%": { transform: "scale(1.12)" },
          "100%": { transform: "scale(1)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(0,255,65,0.4)" },
          "50%": { boxShadow: "0 0 20px rgba(0,255,65,0.9)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
