import type { SandboxMount, SandboxProfile, SandboxRunInput } from './sandbox-profile';

const forbiddenMountPaths = new Set([
  '/var/run/docker.sock',
  '/run/docker.sock',
  '/run/podman/podman.sock',
]);

export function buildPodmanCommand(input: SandboxRunInput) {
  validateInput(input);

  const args = [
    'run',
    '--rm',
    '--name',
    `ceoworkbench-${input.runId}`,
    '--userns',
    input.profile.userns ?? 'keep-id',
    '--network',
    input.profile.network ?? 'none',
    '--workdir',
    input.profile.workdir ?? '/workspace',
  ];

  if (input.profile.readOnlyRoot ?? true) {
    args.push('--read-only');
  }

  appendResourceLimits(args, input.profile);
  appendMount(args, input.profile.workspaceMount);
  appendMount(args, input.profile.homeMount);

  for (const mount of input.profile.extraMounts ?? []) {
    appendMount(args, mount);
  }

  for (const [key, value] of Object.entries(input.profile.env ?? {})) {
    args.push('--env', `${key}=${value}`);
  }

  args.push(input.profile.image, ...input.command);

  return {
    command: 'podman',
    args,
  };
}

function appendResourceLimits(args: string[], profile: SandboxProfile) {
  if (profile.limits?.cpus) {
    args.push('--cpus', profile.limits.cpus);
  }

  if (profile.limits?.memory) {
    args.push('--memory', profile.limits.memory);
  }

  if (profile.limits?.pidsLimit) {
    args.push('--pids-limit', String(profile.limits.pidsLimit));
  }
}

function appendMount(args: string[], mount: SandboxMount) {
  const mode = mount.readonly ? 'ro' : 'rw';
  args.push('--volume', `${mount.hostPath}:${mount.containerPath}:${mode}`);
}

function validateInput(input: SandboxRunInput) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/.test(input.runId)) {
    throw new Error(`Invalid sandbox run id: ${input.runId}`);
  }

  if (input.command.length === 0) {
    throw new Error('Sandbox command must not be empty.');
  }

  const mounts = [
    input.profile.workspaceMount,
    input.profile.homeMount,
    ...(input.profile.extraMounts ?? []),
  ];

  for (const mount of mounts) {
    if (forbiddenMountPaths.has(mount.hostPath) || forbiddenMountPaths.has(mount.containerPath)) {
      throw new Error(`Refusing to mount container runtime socket: ${mount.hostPath} -> ${mount.containerPath}`);
    }
  }
}
