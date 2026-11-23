import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    environment: 'node',
    // Os spikes montam vaults temporarios, junctions e rodam subprocessos.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks',
  },
});