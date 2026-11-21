import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#0F172A",
          card: "#1E293B",
          darker: "#0B0F19",
        },
        feedback: {
          perfect: "#22C55E",
          good: "#F59E0B",
          miss: "#EF4444",
        },
        string: {
          1: "#8B5CF6", // E4 (Purple)
          2: "#0EA5E9", // B3 (Sky Blue)
          3: "#10B981", // G3 (Emerald Green)
          4: "#F59E0B", // D3 (Golden Amber)
          5: "#F97316", // A2 (Vibrant Orange)
          6: "#EF4444", // E2 (Crimson)
          e4: "#8B5CF6",
          b3: "#0EA5E9",
          g3: "#10B981",
          d3: "#F59E0B",
          a2: "#F97316",
          e2: "#EF4444",
        },
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-6px)" },
          "40%, 80%": { transform: "translateX(6px)" },
        },
        "pulse-wait": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.05)" },
        },
      },
      animation: {
        shake: "shake 0.2s ease-in-out",
        "pulse-wait": "pulse-wait 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
