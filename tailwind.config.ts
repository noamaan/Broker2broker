import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101828",
        navy: { 50: "#eef3fa", 100: "#dce6f3", 500: "#355b8d", 700: "#1c3b63", 900: "#102744" },
        leaf: { 50: "#edf8f1", 100: "#d7f0df", 500: "#1d9b5a", 600: "#14834a", 700: "#11673d" },
        sand: "#f6f5f1"
      },
      boxShadow: {
        soft: "0 14px 45px rgba(16, 39, 68, .08)",
        card: "0 7px 24px rgba(16, 39, 68, .06)"
      },
      borderRadius: { "4xl": "2rem" }
    }
  },
  plugins: []
};
export default config;
