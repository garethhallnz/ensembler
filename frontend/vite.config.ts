import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import flowbiteReact from "flowbite-react/plugin/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), flowbiteReact()],
  base: './',
  server: {
    // 5173 is Vite's default and commonly claimed by other local tooling
    // (e.g. a ddev router). Use a distinctive port, bind IPv4 explicitly (the
    // browser resolves localhost to 127.0.0.1 first, and binding only IPv6
    // caused hard-to-diagnose failures), and fail loudly if the port is taken.
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
  },
});