import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('agent image containerfile', () => {
  it('packages the agent runner as the image entrypoint', async () => {
    const containerfile = await readFile('Containerfile.agent', 'utf8');

    expect(containerfile).toContain('FROM node:22-bookworm-slim');
    expect(containerfile).toContain('COPY packages ./packages');
    expect(containerfile).toContain('ENTRYPOINT ["/app/node_modules/.bin/tsx", "/app/packages/agent-runner/src/bin.ts"]');
  });
});
