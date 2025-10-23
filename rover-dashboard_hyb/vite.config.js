import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  base: "./", // Ensure base path is relative for Tauri
  build: {
    outDir: "dist", // Ensure build output is to the 'dist' directory
  },
  server: {
    port: 6969, // Change this to your desired port
  },
});
