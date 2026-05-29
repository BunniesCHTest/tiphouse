import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#081113",
        panel: "#101b1e",
        mint: "#38e2c2",
        coral: "#ff7d67",
        gold: "#f4c95d",
      },
    },
  },
  plugins: [],
};

export default config;
