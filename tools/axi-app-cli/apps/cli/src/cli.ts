import { runCli } from '@axi/scaffold-runtime';

async function main(): Promise<void> {
  try {
    await runCli(process.argv.slice(2), {
      cwd: process.cwd(),
      invokedName: process.argv[1] ?? 'axi',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[axi] ${message}`);
    process.exitCode = 1;
  }
}

void main();
