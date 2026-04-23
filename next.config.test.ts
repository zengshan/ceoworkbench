import { afterEach, describe, expect, it, vi } from 'vitest';

const originalNodeEnv = process.env.NODE_ENV;

async function loadConfig(nodeEnv: string) {
  process.env.NODE_ENV = nodeEnv;
  vi.resetModules();
  return (await import('./next.config.ts')).default;
}

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('next config', () => {
  it('uses a separate dist directory in development', async () => {
    const config = await loadConfig('development');

    expect(config.distDir).toBe('.next-dev');
  });

  it('keeps the default production dist directory for builds', async () => {
    const config = await loadConfig('production');

    expect(config.distDir ?? '.next').toBe('.next');
  });
});
