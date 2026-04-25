import { access, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('sandbox demo scripts', () => {
  it('provides a two-command sandbox demo experience', async () => {
    const setup = await readFile('scripts/setup-agent-sandbox.sh', 'utf8');
    const demo = await readFile('scripts/run-sandbox-demo.sh', 'utf8');

    await expect(access('scripts/setup-agent-sandbox.sh')).resolves.toBeUndefined();
    await expect(access('scripts/run-sandbox-demo.sh')).resolves.toBeUndefined();
    expect(setup).toContain('podman build -f Containerfile.agent -t ceoworkbench-agent:latest .');
    expect(demo).toContain('CEOWORKBENCH_AGENT_ADAPTER=sandbox-json');
    expect(demo).toContain('npm run ceoworkbench -- demo');
  });
});
