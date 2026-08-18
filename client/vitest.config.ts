import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Separate from `vite.config.ts` (build/dev) so the production build never
 * depends on test-only tooling. Tailwind's Vite plugin is intentionally
 * omitted here — tests never need compiled CSS, only React JSX transforms
 * and a DOM to render into (design.md D8).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    restoreMocks: true,
  },
})
