import { defineConfig } from 'vitest/config'
import path from 'path'

// Tests unitaires du domaine Projets (jours ouvrés, fériés, dépendances).
// Alias @/ → src pour résoudre les imports internes comme dans Next.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
