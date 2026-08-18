/// <reference types="vitest/config" />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';
import { coverageConfigDefaults } from 'vitest/config';

export default defineConfig({
  plugins: [angular()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    exclude: ['src/**/*.firebase.spec.ts'],
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/app/**/*.ts'],
      exclude: [
        ...coverageConfigDefaults.exclude,
        'src/app/core/models/**',
        'src/app/core/constants/**',
        'src/app/**/index.ts',
        'src/app/app.config.ts',
        'src/app/app.routes.ts',
      ],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
});
