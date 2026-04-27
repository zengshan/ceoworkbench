import { spawn } from 'node:child_process';
import { buildPodmanCommand } from './podman-command';
import type { SandboxRunInput, SandboxRunResult, SandboxRuntime } from './sandbox-profile';

export class PodmanSandboxRuntime implements SandboxRuntime {
  async run(input: SandboxRunInput): Promise<SandboxRunResult> {
    const { command, args } = buildPodmanCommand(input);
    const timeoutSeconds = input.profile.limits?.timeoutSeconds ?? 60;
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

    const exitPromise = new Promise<number | null>((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code) => resolve(code));
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutSeconds * 1000);

    const exitCode = await exitPromise.finally(() => clearTimeout(timeout));

    return {
      exitCode,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8'),
      timedOut,
    };
  }
}
