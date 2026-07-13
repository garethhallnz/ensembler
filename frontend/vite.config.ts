import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
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
    // Allow importing the repo-root docs/ markdown into the app (?raw).
    fs: { allow: ['..'] },
  },
  test: {
    // Pure-function utils run fast in node; component (*.test.tsx) tests run in a
    // real headless browser (Vitest Browser Mode) for fidelity RTL+jsdom can't give.
    projects: [
      {
        extends: true,
        test: { name: 'unit', environment: 'jsdom', include: ['src/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['src/test/setup.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});