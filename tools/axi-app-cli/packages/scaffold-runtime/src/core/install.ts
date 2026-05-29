import type { ScaffoldConfig } from '@axi/scaffold-kit';
import { runCommand } from '../utils/process.js';

const installSteps = [
  {
    args: ['install'],
    command: 'pnpm',
    label: 'Installing workspace dependencies',
  },
  {
    args: ['python:install'],
    command: 'pnpm',
    label: 'Creating the Python environment',
  },
  {
    args: ['tokens:build'],
    command: 'pnpm',
    label: 'Building design tokens',
  },
  {
    args: ['hooks:install'],
    command: 'pnpm',
    label: 'Installing Git hooks',
  },
  {
    args: ['test:coverage'],
    command: 'pnpm',
    label: 'Running the coverage gate',
  },
];

export async function runInstallPipeline(config: ScaffoldConfig): Promise<void> {
  for (const step of installSteps) {
    console.log(`[axi] ${step.label}...`);
    await runCommand(step.command, step.args, { cwd: config.targetDir });
  }

  if (config.verify) {
    console.log('[axi] Running smoke verification...');
    await runCommand('pnpm', ['verify'], { cwd: config.targetDir });
  }
}
