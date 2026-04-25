import { describe, expect, it } from 'vitest';
import { createCliRuntime, runCli } from './commands';

describe('ceoworkbench CLI commands', () => {
  it('runs the M2 fake manager loop from command calls', async () => {
    const runtime = createCliRuntime();

    expect(await runCli(['company', 'create', 'novel', '--goal', 'Publish a novel'], runtime)).toContain('Created company novel');
    expect(await runCli(['agent', 'create', 'manager', '--role', 'manager'], runtime)).toContain('Created agent manager');
    expect(await runCli(['send', 'manager', '请拆解小说出版项目'], runtime)).toContain('Queued ceo_steer run');
    expect(await runCli(['start', '--once'], runtime)).toContain('Processed run');

    const watchOutput = await runCli(['watch'], runtime);
    const statusOutput = await runCli(['status'], runtime);
    const artifactReport = await runCli(['report', '--artifacts'], runtime);
    const markdownReport = await runCli(['report', '--format', 'markdown'], runtime);

    expect(watchOutput).toContain('run_completed');
    expect(statusOutput).toContain('Company status: novel');
    expect(artifactReport).toContain('project-plan.md');
    expect(markdownReport).toContain('# Run summary:');
  });
});
