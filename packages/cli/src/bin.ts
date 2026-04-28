import { createCliRuntime, runCli } from './commands';

let runtime: ReturnType<typeof createCliRuntime> | undefined;

(async () => {
  runtime = createCliRuntime();
  return runCli(process.argv.slice(2), runtime);
})()
  .then((output) => {
    process.stdout.write(`${output}\n`);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await runtime?.close?.();
  });
