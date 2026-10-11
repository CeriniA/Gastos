import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // The shared package is TypeScript source, so it is compiled into the bundle.
  noExternal: ['@gastos/shared'],
});
