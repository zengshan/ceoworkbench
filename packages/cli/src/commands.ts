import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  RandomIdGenerator,
  SequentialIdGenerator,
  SystemClock,
  getRunKindForMessage,
  getRunPriority,
  type Agent,
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
  const supervisor = new Supervisor({
    storage: runtimeStorage,
    clock,
    ids,
    adapter: createAgentAdapter(options),
    leaseOwner: 'cli-worker',
  });

  return {
    storage: runtimeStorage,
    clock,
    ids,
    supervisor,
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

  if (command === 'company' && subcommand === 'create') {
    const name = rest[0];
    const goal = readOption(rest, '--goal') ?? `${name} company goal`;

    if (!name) {
      throw new Error('Usage: ceoworkbench company create <name> --goal <goal>');
    }

    const now = runtime.clock.now();
    const company: Company = {
      id: runtime.ids.next('company'),
      name,
      goal,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await runtime.storage.createCompany(company);
    return `Created company ${company.name} (${company.id}).`;
  }

  if (command === 'agent' && subcommand === 'create') {
    const name = rest[0];
    const role = readOption(rest, '--role') ?? 'manager';
    const company = await requireCurrentCompany(runtime.storage);

    if (!name) {
      throw new Error('Usage: ceoworkbench agent create <name> --role <role>');
    }

    const now = runtime.clock.now();
    const agent: Agent = {
      id: runtime.ids.next('agent'),
      companyId: company.id,
      name,
      role: role === 'manager' ? 'manager' : 'worker',
      lifecycle: 'on_demand',
      capabilities: ['chat', 'plan', 'report', 'memory.write'],
      sandboxProfile: 'podman-default',
      createdAt: now,
      updatedAt: now,
    };

    await runtime.storage.createAgent(agent);
    return `Created agent ${agent.name} (${agent.role}).`;
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

    const message: Message = {
      id: runtime.ids.next('message'),
      companyId: company.id,
      agentId: agent.id,
      author: 'ceo',
      kind: normalizeMessageKind(kind),
      content,
      createdAt: runtime.clock.now(),
    };

    const runKind = getRunKindForMessage(message.kind);
    await runtime.supervisor.handleMessage(message, agent);
    return `Queued ${runKind} run for ${agent.name} at priority ${getRunPriority(runKind)}.`;
  }

  if (command === 'start') {
    const company = await requireCurrentCompany(runtime.storage);
    const maxTicks = Number(readOption([subcommand, ...rest].filter(Boolean), '--max-ticks') ?? 1);

    if (!Number.isInteger(maxTicks) || maxTicks < 1) {
      throw new Error('Usage: ceoworkbench start [--once] [--max-ticks <count>]');
    }

    if (maxTicks > 1) {
      let processed = 0;

      for (let tick = 0; tick < maxTicks; tick += 1) {
        const run = await runtime.supervisor.tick(company.id);

        if (!run) {
          break;
        }

        processed += 1;
      }

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
    'ceoworkbench company create <name> --goal <goal>',
    'ceoworkbench agent create <name> --role manager',
    'ceoworkbench send <agent> <message>',
    'ceoworkbench start [--once] [--max-ticks <count>]',
    'ceoworkbench watch',
    'ceoworkbench status',
    'ceoworkbench team',
    'ceoworkbench briefing',
    'ceoworkbench timeline',
    'ceoworkbench report [--artifacts] [--format markdown]',
  ].join('\n');
}

function createDefaultStorage(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): RuntimeStorage {
  const connectionString = env.CEOWORKBENCH_DATABASE_URL ?? env.DATABASE_URL;

  if (connectionString) {
    return new PostgresStorage({ connectionString });
  }

  return new MemoryStorage();
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
  const company = (await storage.listCompanies())[0];

  if (!company) {
    throw new Error('No company exists. Run: ceoworkbench company create <name> --goal <goal>');
  }

  return company;
}

async function requireAgent(storage: Storage, companyId: string, agentName?: string) {
  const agent = (await storage.listAgents(companyId)).find((candidate) => candidate.name === agentName);

  if (!agent) {
    throw new Error(`Agent not found: ${agentName}`);
  }

  return agent;
}
