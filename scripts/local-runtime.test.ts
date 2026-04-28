import { access, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('local runtime scripts', () => {
  it('provides start, report, and cleanup scripts for the local Postgres sandbox runtime', async () => {
    const start = await readFile('scripts/start-local-runtime.sh', 'utf8');
    const report = await readFile('scripts/watch-report.sh', 'utf8');
    const cleanup = await readFile('scripts/clean-local-runtime.sh', 'utf8');
    const demo = await readFile('scripts/run-sandbox-demo.sh', 'utf8');

    await expect(access('scripts/start-local-runtime.sh')).resolves.toBeUndefined();
    await expect(access('scripts/watch-report.sh')).resolves.toBeUndefined();
    await expect(access('scripts/clean-local-runtime.sh')).resolves.toBeUndefined();
    expect(start).toContain('podman run -d');
    expect(start).toContain('postgres:16-alpine');
    expect(start).toContain('CEOWORKBENCH_DATABASE_URL=');
    expect(start).toContain('CEOWORKBENCH_RUNNER_ADAPTER=openai-responses');
    expect(start).toContain('source "$env_file"');
    expect(start).toContain('${OPENAI_BASE_URL:+export OPENAI_BASE_URL="$OPENAI_BASE_URL"}');
    expect(start).toContain('${OPENAI_API_KEY:+export OPENAI_API_KEY="$OPENAI_API_KEY"}');
    expect(start).toContain('OPENAI_API_KEY');
    expect(start).toContain('npm run ceoworkbench -- db migrate');
    expect(report).toContain('npm run ceoworkbench -- briefing');
    expect(report).toContain('npm run ceoworkbench -- timeline');
    expect(report).toContain('npm run ceoworkbench -- team');
    expect(cleanup).toContain('podman rm -f "$container_name"');
    expect(cleanup).toContain('env_file=".ceoworkbench/local.env"');
    expect(cleanup).toContain('cp "$env_file" "$env_backup"');
    expect(cleanup).toContain('rm -rf .ceoworkbench');
    expect(cleanup).toContain('cp "$env_backup" "$env_file"');
    expect(demo).toContain('source .ceoworkbench/local.env');
  });
});
