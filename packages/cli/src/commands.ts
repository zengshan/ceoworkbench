import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  RandomIdGenerator,
  SequentialIdGenerator,
  SystemClock,
  getRunKindForMessage,
  getRunPriority,
  type Agent,
  type Artifact,
  type Clock,
  type Company,
  type IdGenerator,
  type Message,
  type MessageKind,
} from '../../core/src';
import { buildArtifactReport, buildBriefingReport, buildDecisionReport, buildRunSummaryReport, buildStatusReport, buildTimelineReport, renderMarkdownReport, renderTerminalReport } from '../../reporter/src';
import { FakeManagerAdapter, SandboxedJsonAgentAdapter, type AgentAdapter, type AgentContext } from '../../runtime/src';
import { PodmanSandboxRuntime, defaultSandboxProfile, type SandboxRuntime } from '../../sandbox-podman/src';
import { Supervisor } from '../../supervisor/src';
import { MemoryStorage, type Storage } from '../../storage/src';
import { PostgresStorage } from '../../storage-postgres/src';

export type CliRuntimeOptions = {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  sandboxRuntime?: SandboxRuntime;
};

export type CliRuntime = {
  storage: RuntimeStorage;
  clock: Clock;
  ids: IdGenerator;
  supervisor: Supervisor;
  workspaceRoot: string;
  close?: () => Promise<void>;
};

export type RuntimeStorage = Storage & {
  migrate?: () => Promise<void>;
  close?: () => Promise<void>;
};

export function createCliRuntime(storage?: RuntimeStorage, options: CliRuntimeOptions = {}): CliRuntime {
  const runtimeStorage = storage ?? createDefaultStorage(options.env);
  const clock = new SystemClock();
  const ids = runtimeStorage instanceof MemoryStorage ? new SequentialIdGenerator() : new RandomIdGenerator();
  const workspaceRoot = getWorkspaceRoot(options.env);
  const supervisor = new Supervisor({
    storage: runtimeStorage,
    clock,
    ids,
    adapter: createAgentAdapter(options),
    leaseOwner: 'cli-worker',
    writeArtifact: createArtifactWriter(runtimeStorage),
  });

  return {
    storage: runtimeStorage,
    clock,
    ids,
    supervisor,
    workspaceRoot,
    close: runtimeStorage.close ? () => runtimeStorage.close!() : undefined,
  };
}

export async function runCli(args: string[], runtime = createCliRuntime()): Promise<string> {
  const [command, subcommand, ...rest] = args;

  if (!command || command === 'help') {
    return help();
  }

  if (command === 'init') {
    if (runtime.storage.migrate) {
      await runtime.storage.migrate();
      return 'Initialized ceoworkbench Postgres runtime.';
    }

    return 'Initialized ceoworkbench runtime.';
  }

  if (command === 'db' && subcommand === 'migrate') {
    if (!runtime.storage.migrate) {
      return 'No database storage configured. Set CEOWORKBENCH_DATABASE_URL or DATABASE_URL.';
    }

    await runtime.storage.migrate();
    return 'Postgres schema migrated.';
  }

  if (command === 'demo') {
    const lines = [
      await runCli(['company', 'create', 'novel', '--goal', 'Publish a novel'], runtime),
      await runCli(['agent', 'create', 'manager', '--role', 'manager'], runtime),
      await runCli(['send', 'manager', '请拆解小说出版项目'], runtime),
      await runCli(['start', '--once'], runtime),
      '',
      await runCli(['watch'], runtime),
      '',
      await runCli(['report', '--artifacts'], runtime),
    ];

    return lines.join('\n');
  }

  if (command === 'company' && subcommand === 'init') {
    const name = rest[0];
    const goal = readOption(rest, '--goal') ?? `${name} company goal`;

    if (!name) {
      throw new Error('Usage: ceoworkbench company init <name> --goal <goal>');
    }

    const company = await createCompany(runtime, name, goal);
    const manager = await createAgent(runtime, company.id, 'manager', 'manager');
    await runtime.storage.createMemoryEntry({
      id: runtime.ids.next('memory'),
      companyId: company.id,
      kind: 'goal',
      title: 'Company charter',
      content: goal,
      createdAt: runtime.clock.now(),
    });

    return `Initialized company ${company.name} (${company.id}) with CEO Office manager ${manager.name}.`;
  }

  if (command === 'company' && subcommand === 'create') {
    const name = rest[0];
    const goal = readOption(rest, '--goal') ?? `${name} company goal`;

    if (!name) {
      throw new Error('Usage: ceoworkbench company create <name> --goal <goal>');
    }

    const company = await createCompany(runtime, name, goal);
    return `Created company ${company.name} (${company.id}).`;
  }

  if (command === 'agent' && subcommand === 'create') {
    const name = rest[0];
    const role = readOption(rest, '--role') ?? 'manager';
    const company = await requireCurrentCompany(runtime.storage);

    if (!name) {
      throw new Error('Usage: ceoworkbench agent create <name> --role <role>');
    }

    const agent = await createAgent(runtime, company.id, name, role);
    return `Created agent ${agent.name} (${agent.role}).`;
  }

  if (command === 'ceo') {
    const content = [subcommand, ...rest].filter(Boolean).join(' ');
    const company = await requireCurrentCompany(runtime.storage);
    const manager = await requireManager(runtime.storage, company.id);

    if (!content) {
      throw new Error('Usage: ceoworkbench ceo <message>');
    }

    return queueCeoMessage(runtime, company, manager, content, 'steer');
  }

  if (command === 'send') {
    const agentName = subcommand;
    const content = readPositional(rest).join(' ');
    const kind = readOption(rest, '--type') ?? 'steer';
    const company = await requireCurrentCompany(runtime.storage);
    const agent = await requireAgent(runtime.storage, company.id, agentName);

    if (!agentName || !content) {
      throw new Error('Usage: ceoworkbench send <agent> <message> [--type steer|follow_up]');
    }

    return queueCeoMessage(runtime, company, agent, content, normalizeMessageKind(kind));
  }

  if (command === 'work') {
    const company = await requireCurrentCompany(runtime.storage);
    const untilIdle = [subcommand, ...rest].includes('--until-idle');
    const ticks = Number(readOption([subcommand, ...rest].filter(Boolean), '--ticks') ?? (untilIdle ? 100 : 1));

    if (!Number.isInteger(ticks) || ticks < 1) {
      throw new Error('Usage: ceoworkbench work [--until-idle] [--ticks <count>]');
    }

    const processed = await processRuns(runtime, company.id, ticks);
    return processed === 0 ? 'No queued runs.' : `Processed ${processed} runs.`;
  }

  if (command === 'start') {
    const company = await requireCurrentCompany(runtime.storage);
    const maxTicks = Number(readOption([subcommand, ...rest].filter(Boolean), '--max-ticks') ?? 1);

    if (!Number.isInteger(maxTicks) || maxTicks < 1) {
      throw new Error('Usage: ceoworkbench start [--once] [--max-ticks <count>]');
    }

    if (maxTicks > 1) {
      const processed = await processRuns(runtime, company.id, maxTicks);

      return processed === 0 ? 'No queued runs.' : `Processed ${processed} runs.`;
    }

    const run = await runtime.supervisor.tick(company.id);
    return run ? `Processed run ${run.id}.` : 'No queued runs.';
  }

  if (command === 'watch') {
    const company = await requireCurrentCompany(runtime.storage);
    const events = await runtime.storage.listEvents(company.id);
    return events.map((event) => `* ${event.type} ${event.runId ? `(${event.runId})` : ''}`.trim()).join('\n');
  }

  if (command === 'status') {
    const company = await requireCurrentCompany(runtime.storage);
    return renderTerminalReport(await buildStatusReport(runtime.storage, company.id));
  }

  if (command === 'team') {
    const company = await requireCurrentCompany(runtime.storage);
    return renderTerminalReport(await buildStatusReport(runtime.storage, company.id));
  }

  if (command === 'briefing') {
    const company = await requireCurrentCompany(runtime.storage);
    return renderTerminalReport(await buildBriefingReport(runtime.storage, company.id));
  }

  if (command === 'timeline') {
    const company = await requireCurrentCompany(runtime.storage);
    return renderTerminalReport(await buildTimelineReport(runtime.storage, company.id));
  }

  if (command === 'report') {
    const company = await requireCurrentCompany(runtime.storage);
    const format = readOption([subcommand, ...rest].filter(Boolean), '--format') ?? 'terminal';
    const reportArgs = [subcommand, ...rest];
    const report = reportArgs.includes('--artifacts')
      ? await buildArtifactReport(runtime.storage, company.id)
      : reportArgs.includes('--decisions')
        ? await buildDecisionReport(runtime.storage, company.id)
        : await buildRunSummaryReport(runtime.storage, company.id);

    return format === 'markdown' ? renderMarkdownReport(report) : renderTerminalReport(report);
  }

  if (command === 'artifact') {
    const company = await requireCurrentCompany(runtime.storage);

    if (subcommand === 'list') {
      const artifacts = await runtime.storage.listArtifacts(company.id);
      return artifacts.length
        ? artifacts.map((artifact, index) => `${index + 1}. ${artifact.path} (${artifact.status})`).join('\n')
        : 'No artifacts.';
    }

    if (subcommand === 'show') {
      const selector = rest[0] ?? 'latest';
      const artifact = await requireArtifact(runtime.storage, company.id, selector);
      const content = await readArtifactContent(company, artifact);
      return `${artifact.path}\n\n${content}`;
    }

    throw new Error('Usage: ceoworkbench artifact list | artifact show latest');
  }

  if (command === 'decide') {
    const decisionId = subcommand;
    const option = readOption(rest, '--option') ?? readOption(rest, '--custom');
    const company = await requireCurrentCompany(runtime.storage);
    const manager = (await runtime.storage.listAgents(company.id)).find((agent) => agent.role === 'manager');

    if (!decisionId || !option || !manager) {
      throw new Error('Usage: ceoworkbench decide <decision-id> --option <option>');
    }

    await runtime.storage.resolveDecisionRequest(decisionId, runtime.clock.now());
    const message: Message = {
      id: runtime.ids.next('message'),
      companyId: company.id,
      agentId: manager.id,
      author: 'ceo',
      kind: 'decision',
      content: `Decision ${decisionId}: ${option}`,
      createdAt: runtime.clock.now(),
    };
    const runKind = getRunKindForMessage(message.kind);
    await runtime.supervisor.handleMessage(message, manager);

    return `Resolved decision ${decisionId} with ${option}. Queued ${runKind} run.`;
  }

  throw new Error(`Unknown command: ${args.join(' ')}`);
}

function help() {
  return [
    'ceoworkbench init',
    'ceoworkbench db migrate',
    'ceoworkbench demo',
    'ceoworkbench company init <name> --goal <goal>',
    'ceoworkbench company create <name> --goal <goal>',
    'ceoworkbench agent create <name> --role manager',
    'ceoworkbench ceo <message>',
    'ceoworkbench send <agent> <message>',
    'ceoworkbench work [--until-idle] [--ticks <count>]',
    'ceoworkbench start [--once] [--max-ticks <count>]',
    'ceoworkbench watch',
    'ceoworkbench status',
    'ceoworkbench team',
    'ceoworkbench briefing',
    'ceoworkbench timeline',
    'ceoworkbench artifact list',
    'ceoworkbench artifact show latest',
    'ceoworkbench report [--artifacts] [--format markdown]',
  ].join('\n');
}

async function createCompany(runtime: CliRuntime, name: string, goal: string) {
  const now = runtime.clock.now();
  const company: Company = {
    id: runtime.ids.next('company'),
    name,
    goal,
    status: 'active',
    workspacePath: path.join(runtime.workspaceRoot, name),
    createdAt: now,
    updatedAt: now,
  };

  await mkdir(company.workspacePath!, { recursive: true });
  await runtime.storage.createCompany(company);
  return company;
}

async function createAgent(runtime: CliRuntime, companyId: string, name: string, role: string) {
  const now = runtime.clock.now();
  const agent: Agent = {
    id: runtime.ids.next('agent'),
    companyId,
    name,
    role: role === 'manager' ? 'manager' : 'worker',
    lifecycle: 'on_demand',
    capabilities: ['chat', 'plan', 'report', 'memory.write'],
    sandboxProfile: 'podman-default',
    createdAt: now,
    updatedAt: now,
  };

  await runtime.storage.createAgent(agent);
  return agent;
}

async function queueCeoMessage(runtime: CliRuntime, company: Company, agent: Agent, content: string, kind: MessageKind) {
  const message: Message = {
    id: runtime.ids.next('message'),
    companyId: company.id,
    agentId: agent.id,
    author: 'ceo',
    kind,
    content,
    createdAt: runtime.clock.now(),
  };

  const runKind = getRunKindForMessage(message.kind);
  await runtime.supervisor.handleMessage(message, agent);
  return `Queued ${runKind} run for ${agent.name} at priority ${getRunPriority(runKind)}.`;
}

async function processRuns(runtime: CliRuntime, companyId: string, ticks: number) {
  let processed = 0;

  for (let tick = 0; tick < ticks; tick += 1) {
    const run = await runtime.supervisor.tick(companyId);

    if (!run) {
      break;
    }

    processed += 1;
  }

  return processed;
}

function createDefaultStorage(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): RuntimeStorage {
  const connectionString = env.CEOWORKBENCH_DATABASE_URL ?? env.DATABASE_URL;

  if (connectionString) {
    return new PostgresStorage({ connectionString });
  }

  return new MemoryStorage();
}

function getWorkspaceRoot(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  return env.CEOWORKBENCH_WORKSPACE_ROOT ?? path.join(process.cwd(), '.ceoworkbench', 'workspaces');
}

function createArtifactWriter(storage: RuntimeStorage) {
  return async (artifact: Artifact) => {
    if (!artifact.content) {
      return;
    }

    const company = (await storage.listCompanies()).find((candidate) => candidate.id === artifact.companyId);
    const workspacePath = company?.workspacePath;

    if (!workspacePath) {
      return;
    }

    const artifactPath = path.join(workspacePath, artifact.path);
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, `${artifact.content.trimEnd()}\n`, 'utf8');
  };
}

function createAgentAdapter(options: CliRuntimeOptions): AgentAdapter {
  const env = options.env ?? process.env;

  if (env.CEOWORKBENCH_AGENT_ADAPTER !== 'sandbox-json') {
    return new FakeManagerAdapter();
  }

  const sandboxRoot = env.CEOWORKBENCH_SANDBOX_ROOT ?? path.join(process.cwd(), '.ceoworkbench', 'sandbox');
  const image = env.CEOWORKBENCH_AGENT_IMAGE ?? 'ceoworkbench-agent:latest';
  const commandTemplate = splitCommand(env.CEOWORKBENCH_AGENT_COMMAND ?? '');

  return new SandboxedJsonAgentAdapter({
    runtime: options.sandboxRuntime ?? new PodmanSandboxRuntime(),
    contextPathsForContext: (context) => {
      const paths = buildSandboxPaths(sandboxRoot, context);

      return {
        hostPath: path.join(paths.homeHostPath, 'context.json'),
        containerPath: '/home/agent/context.json',
      };
    },
    resultPathsForContext: (context) => {
      const paths = buildSandboxPaths(sandboxRoot, context);

      return {
        hostPath: path.join(paths.homeHostPath, 'result.json'),
        containerPath: '/home/agent/result.json',
      };
    },
    writeContext: async (contextPath, context) => {
      const paths = buildSandboxPaths(sandboxRoot, context);
      await Promise.all([
        mkdir(paths.workspaceHostPath, { recursive: true }),
        mkdir(paths.homeHostPath, { recursive: true }),
      ]);
      await writeFile(contextPath, `${JSON.stringify(context, null, 2)}\n`, 'utf8');
    },
    readResult: (resultPath) => readFile(resultPath, 'utf8'),
    profileForContext: (context) => {
      const paths = buildSandboxPaths(sandboxRoot, context);

      return defaultSandboxProfile({
        image,
        workspaceMount: {
          hostPath: paths.workspaceHostPath,
          containerPath: '/workspace',
        },
        homeMount: {
          hostPath: paths.homeHostPath,
          containerPath: '/home/agent',
        },
      });
    },
    commandForContext: (_context, protocol) => [
      ...commandTemplate,
      protocol.contextContainerPath ?? '/home/agent/context.json',
      protocol.resultContainerPath ?? '/home/agent/result.json',
    ],
  });
}

function buildSandboxPaths(sandboxRoot: string, context: AgentContext) {
  const companyRoot = path.join(sandboxRoot, context.run.companyId);
  const runRoot = path.join(companyRoot, 'runs', context.run.id);

  return {
    workspaceHostPath: path.join(companyRoot, 'workspace'),
    homeHostPath: path.join(runRoot, 'home'),
  };
}

function splitCommand(command: string) {
  return command.trim().split(/\s+/).filter(Boolean);
}

function readOption(args: string[], option: string) {
  const index = args.indexOf(option);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function readPositional(args: string[]) {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value.startsWith('--')) {
      index += 1;
      continue;
    }

    values.push(value);
  }

  return values;
}

function normalizeMessageKind(kind: string): MessageKind {
  if (kind === 'follow_up' || kind === 'follow-up') {
    return 'follow_up';
  }

  if (kind === 'decision' || kind === 'report') {
    return kind;
  }

  return 'steer';
}

async function requireCurrentCompany(storage: Storage) {
  const company = (await storage.listCompanies()).at(-1);

  if (!company) {
    throw new Error('No company exists. Run: ceoworkbench company init <name> --goal <goal>');
  }

  return company;
}

async function requireManager(storage: Storage, companyId: string) {
  const manager = (await storage.listAgents(companyId)).find((agent) => agent.role === 'manager');

  if (!manager) {
    throw new Error('Manager agent not found. Run: ceoworkbench agent create manager --role manager');
  }

  return manager;
}

async function requireArtifact(storage: Storage, companyId: string, selector: string) {
  const artifacts = await storage.listArtifacts(companyId);
  const artifact = selector === 'latest'
    ? artifacts.at(-1)
    : artifacts.find((candidate) => candidate.id === selector || candidate.path === selector);

  if (!artifact) {
    throw new Error(`Artifact not found: ${selector}`);
  }

  return artifact;
}

async function readArtifactContent(company: Company, artifact: Artifact) {
  if (artifact.content) {
    return artifact.content;
  }

  if (!company.workspacePath) {
    return `No workspace path is configured for company ${company.name}.`;
  }

  const artifactPath = path.join(company.workspacePath, artifact.path);

  try {
    return await readFile(artifactPath, 'utf8');
  } catch {
    return `Artifact file not found on disk: ${artifactPath}`;
  }
}

async function requireAgent(storage: Storage, companyId: string, agentName?: string) {
  const agent = (await storage.listAgents(companyId)).find((candidate) => candidate.name === agentName);

  if (!agent) {
    throw new Error(`Agent not found: ${agentName}`);
  }

  return agent;
}
