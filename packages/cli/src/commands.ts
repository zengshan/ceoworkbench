import {
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
import { buildArtifactReport, buildRunSummaryReport, buildStatusReport, renderMarkdownReport, renderTerminalReport } from '../../reporter/src';
import { FakeManagerAdapter } from '../../runtime/src';
import { Supervisor } from '../../supervisor/src';
import { MemoryStorage, type Storage } from '../../storage/src';

export type CliRuntime = {
  storage: Storage;
  clock: Clock;
  ids: IdGenerator;
  supervisor: Supervisor;
};

export function createCliRuntime(storage = new MemoryStorage()): CliRuntime {
  const clock = new SystemClock();
  const ids = new SequentialIdGenerator();
  const supervisor = new Supervisor({
    storage,
    clock,
    ids,
    adapter: new FakeManagerAdapter(),
    leaseOwner: 'cli-worker',
  });

  return { storage, clock, ids, supervisor };
}

export async function runCli(args: string[], runtime = createCliRuntime()): Promise<string> {
  const [command, subcommand, ...rest] = args;

  if (!command || command === 'help') {
    return help();
  }

  if (command === 'init') {
    return 'Initialized ceoworkbench runtime.';
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
    const content = rest.filter((value) => !value.startsWith('--')).join(' ');
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

  if (command === 'report') {
    const company = await requireCurrentCompany(runtime.storage);
    const format = readOption([subcommand, ...rest].filter(Boolean), '--format') ?? 'terminal';
    const report = [subcommand, ...rest].includes('--artifacts')
      ? await buildArtifactReport(runtime.storage, company.id)
      : await buildRunSummaryReport(runtime.storage, company.id);

    return format === 'markdown' ? renderMarkdownReport(report) : renderTerminalReport(report);
  }

  throw new Error(`Unknown command: ${args.join(' ')}`);
}

function help() {
  return [
    'ceoworkbench init',
    'ceoworkbench demo',
    'ceoworkbench company create <name> --goal <goal>',
    'ceoworkbench agent create <name> --role manager',
    'ceoworkbench send <agent> <message>',
    'ceoworkbench start --once',
    'ceoworkbench watch',
    'ceoworkbench status',
    'ceoworkbench report [--artifacts] [--format markdown]',
  ].join('\n');
}

function readOption(args: string[], option: string) {
  const index = args.indexOf(option);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
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
