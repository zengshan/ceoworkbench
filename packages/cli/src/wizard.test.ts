import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createCliRuntime } from './commands';
import { runWizard } from './wizard';

const missingConfigPath = path.join(tmpdir(), 'ceoworkbench-wizard-test-missing-local.env');

function createFakeCliRuntime() {
  return createCliRuntime(undefined, {
    env: {
      CEOWORKBENCH_CONFIG_PATH: missingConfigPath,
      CEOWORKBENCH_AGENT_ADAPTER: 'fake',
    },
  });
}

describe('ceoworkbench wizard', () => {
  it('maps onboarding steps to existing CLI commands and asks only required prompts', async () => {
    const runtime = createFakeCliRuntime();
    const prompts: string[] = [];
    const runCommand = vi.fn(async (args: string[]) => `ran ${args.join(' ')}`);
    const sessionRoot = await mkdtemp(path.join(tmpdir(), 'ceoworkbench-wizard-'));

    const output = await runWizard(runtime, {
      sessionRoot,
      idGenerator: () => 'session-a',
      prompt: async (question) => {
        prompts.push(question);
        if (question === 'Company name: ') {
          return 'novel';
        }
        if (question === 'Company goal: ') {
          return 'Publish a novel';
        }
        return 'Draft the first plan';
      },
      runCommand,
      mode: 'bootstrap',
    });

    expect(prompts).toEqual([
      'Company name: ',
      'Company goal: ',
      'What should the CEO tell the manager? ',
    ]);
    expect(prompts.join('\n')).not.toMatch(/start|initialize|default|enable/i);
    expect(runCommand).toHaveBeenCalledWith(['company', 'init', 'novel', '--goal', 'Publish a novel']);
    expect(runCommand).toHaveBeenCalledWith(['ceo', 'Draft the first plan']);
    expect(output).toContain('Wizard executed:');
    expect(output).toContain('Equivalent commands:');
    expect(output).toContain('npm run ceoworkbench -- company init novel --goal');
    expect(output).toContain('npm run ceoworkbench -- ceo');
  });

  it('prints equivalent commands that can run through the CLI command runner', async () => {
    const runtime = createFakeCliRuntime();
    const sessionRoot = await mkdtemp(path.join(tmpdir(), 'ceoworkbench-wizard-'));
    const output = await runWizard(runtime, {
      sessionRoot,
      idGenerator: () => 'session-b',
      prompt: async (question) => {
        if (question.includes('name')) {
          return 'novel';
        }
        if (question.includes('goal')) {
          return 'Publish a novel';
        }
        return 'Draft the first plan';
      },
      mode: 'bootstrap',
    });

    expect(output).toContain('Wizard executed:');
    expect(output).toContain('Equivalent commands:');
    expect(output).toContain('npm run ceoworkbench -- company init novel --goal');
    expect(output).toContain('npm run ceoworkbench -- ceo');
  });

  it('uses message files for complex CEO messages in equivalent commands', async () => {
    const runtime = createFakeCliRuntime();
    const sessionRoot = await mkdtemp(path.join(tmpdir(), 'ceoworkbench-wizard-'));
    await runtime.storage.createCompany({
      id: 'company-1',
      name: 'existing',
      goal: 'Existing goal',
      status: 'active',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await runtime.storage.createAgent({
      id: 'agent-1',
      companyId: 'company-1',
      name: 'manager',
      role: 'manager',
      lifecycle: 'on_demand',
      capabilities: [],
      sandboxProfile: 'podman-default',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const message = 'Line one\nLine "two" with spaces';
    const output = await runWizard(runtime, {
      sessionRoot,
      idGenerator: () => 'session-c',
      prompt: async () => message,
      mode: 'ceo_instruction',
    });

    expect(output).toContain('--message-file');
    expect(await readFile(path.join(sessionRoot, 'session-c-msg.txt'), 'utf8')).toBe(message);
  });

  it('continues, discards, and rejects incompatible checkpoint sessions', async () => {
    const runtime = createFakeCliRuntime();
    const sessionRoot = await mkdtemp(path.join(tmpdir(), 'ceoworkbench-wizard-'));

    await runWizard(runtime, {
      sessionRoot,
      idGenerator: () => 'session-d',
      prompt: async (question) => question.includes('name') ? 'novel' : 'Publish a novel',
      mode: 'bootstrap',
      stopAfterCheckpoint: true,
    });

    const continued = await runWizard(runtime, {
      sessionRoot,
      prompt: async () => 'continue',
      mode: 'resume',
    });
    expect(continued).toContain('Resumed wizard session session-d');

    const discarded = await runWizard(runtime, {
      sessionRoot,
      prompt: async () => 'discard',
      mode: 'resume',
    });
    expect(discarded).toContain('Discarded wizard session session-d');

    await runWizard(runtime, {
      sessionRoot,
      idGenerator: () => 'session-e',
      prompt: async (question) => question.includes('name') ? 'novel' : 'Publish a novel',
      mode: 'bootstrap',
      stopAfterCheckpoint: true,
      schemaVersionOverride: 999,
    });

    await expect(runWizard(runtime, {
      sessionRoot,
      prompt: async () => 'continue',
      mode: 'resume',
    })).rejects.toThrow('Unsupported wizard session schema_version 999');
  });

  it('prompts for the missing CEO instruction when resuming a bootstrap checkpoint', async () => {
    const runtime = createFakeCliRuntime();
    const sessionRoot = await mkdtemp(path.join(tmpdir(), 'ceoworkbench-wizard-'));

    await runWizard(runtime, {
      sessionRoot,
      idGenerator: () => 'session-needs-message',
      prompt: async (question) => question.includes('name') ? 'novel' : 'Publish a novel',
      mode: 'bootstrap',
      stopAfterCheckpoint: true,
    });

    const prompts: string[] = [];
    const output = await runWizard(runtime, {
      sessionRoot,
      prompt: async (question) => {
        prompts.push(question);
        return prompts.length === 1 ? 'continue' : 'Draft the first plan';
      },
      mode: 'resume',
    });

    expect(prompts).toEqual([
      'Resume wizard session session-needs-message? continue/discard ',
      'What should the CEO tell the manager? ',
    ]);
    expect(output).toContain('ceo.instruction message="Draft the first plan"');

    const runs = await runtime.storage.listRuns('company-000001');
    expect(runs).toHaveLength(1);
    expect(runs[0].kind).toBe('ceo_steer');
  });

  it('replays company init from an executed checkpoint when runtime state is empty', async () => {
    const sessionRoot = await mkdtemp(path.join(tmpdir(), 'ceoworkbench-wizard-'));
    const firstRuntime = createFakeCliRuntime();

    await runWizard(firstRuntime, {
      sessionRoot,
      idGenerator: () => 'session-replay',
      prompt: async (question) => question.includes('name') ? 'novel' : 'Publish a novel',
      mode: 'bootstrap',
    });

    const secondRuntime = createFakeCliRuntime();
    const output = await runWizard(secondRuntime, {
      sessionRoot,
      prompt: async () => 'continue',
      mode: 'resume',
    });

    expect(output).toContain('Resumed wizard session session-replay');
    expect((await secondRuntime.storage.listCompanies()).at(-1)?.name).toBe('novel');
  });

  it('stores concurrent sessions in independent checkpoint files', async () => {
    const runtime = createFakeCliRuntime();
    const sessionRoot = await mkdtemp(path.join(tmpdir(), 'ceoworkbench-wizard-'));

    await runWizard(runtime, {
      sessionRoot,
      idGenerator: () => 'session-f',
      prompt: async (question) => question.includes('name') ? 'novel-a' : 'Goal A',
      mode: 'bootstrap',
      stopAfterCheckpoint: true,
    });
    await runWizard(runtime, {
      sessionRoot,
      idGenerator: () => 'session-g',
      prompt: async (question) => question.includes('name') ? 'novel-b' : 'Goal B',
      mode: 'bootstrap',
      stopAfterCheckpoint: true,
    });

    expect((await readdir(sessionRoot)).sort()).toEqual(['session-f.json', 'session-g.json']);
    expect(await readFile(path.join(sessionRoot, 'session-f.json'), 'utf8')).toContain('novel-a');
    expect(await readFile(path.join(sessionRoot, 'session-g.json'), 'utf8')).toContain('novel-b');
  });
});
