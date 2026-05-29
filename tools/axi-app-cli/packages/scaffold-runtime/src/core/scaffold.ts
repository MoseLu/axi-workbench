import path from 'node:path';

import { parseCliArgs, renderUsage } from './args.js';
import { resolveScaffoldConfig } from './context.js';
import { runInstallPipeline } from './install.js';
import { runDoctorCommand, runListCommand } from './ops.js';
import { renderProjectFiles } from './template.js';
import {
  ensureTargetDirectoryIsSafe,
  removeStaleManagedFiles,
  writeProjectFiles,
} from '../utils/fs.js';
import type { ParsedArgs, ScaffoldConfig } from '@axi/scaffold-kit';

const CLI_VERSION = '1.0.0';

function getActionLabel(command: 'init' | 'create' | 'add' | 'sync'): {
  done: string;
  progress: string;
} {
  switch (command) {
    case 'add':
      return { done: 'modules updated', progress: 'updating' };
    case 'sync':
      return { done: 'scaffold synchronized', progress: 'synchronizing' };
    default:
      return { done: 'scaffold ready', progress: 'generating' };
  }
}

async function applyScaffoldConfig(scaffoldConfig: ScaffoldConfig): Promise<void> {
  if (scaffoldConfig.command === 'init' || scaffoldConfig.command === 'create') {
    await ensureTargetDirectoryIsSafe(scaffoldConfig.targetDir);
  }

  const projectFiles = renderProjectFiles(scaffoldConfig);
  const actionLabel = getActionLabel(scaffoldConfig.command);

  console.log(
    `[axi] ${actionLabel.progress} ${projectFiles.length} files in ${scaffoldConfig.targetDir}`,
  );
  await removeStaleManagedFiles(
    scaffoldConfig.targetDir,
    scaffoldConfig.manifest?.managedFiles ?? [],
    projectFiles.map((projectFile) => projectFile.path),
  );
  await writeProjectFiles(scaffoldConfig.targetDir, projectFiles);
  console.log(`[axi] ${actionLabel.done} for ${scaffoldConfig.projectName}`);

  if (!scaffoldConfig.install) {
    console.log('[axi] skipped dependency installation (--no-install).');
    return;
  }

  await runInstallPipeline(scaffoldConfig);
  console.log('[axi] setup complete.');
}

function createSyncArgs(parsedArgs: ParsedArgs): ParsedArgs {
  return {
    ...parsedArgs,
    command: 'sync',
    featureIds: [],
    fix: false,
    install: false,
    interactive: false,
    json: false,
    verify: false,
    yes: false,
  };
}

export async function runCli(
  rawArgv: string[],
  options: { cwd?: string; invokedName?: string } = {},
): Promise<void> {
  const invokedName = options.invokedName ?? 'axi';

  if (rawArgv.includes('--help') || rawArgv.includes('-h')) {
    console.log(renderUsage(invokedName));
    return;
  }

  if (rawArgv.includes('--version') || rawArgv.includes('-v')) {
    console.log(CLI_VERSION);
    return;
  }

  const parsedArgs = parseCliArgs(rawArgv, options.cwd ?? process.cwd(), path.basename(invokedName));

  if (parsedArgs.command === 'list') {
    await runListCommand(parsedArgs.cwd, { json: parsedArgs.json });
    return;
  }

  if (parsedArgs.command === 'doctor') {
    const report = await runDoctorCommand(parsedArgs.cwd, {
      fix: parsedArgs.fix,
      json: parsedArgs.json,
      syncProject: parsedArgs.fix
        ? async () => {
            const syncConfig = await resolveScaffoldConfig(createSyncArgs(parsedArgs));
            await applyScaffoldConfig(syncConfig);
          }
        : undefined,
    });

    if (parsedArgs.json && !report.ok) {
      process.exitCode = 1;
    }

    return;
  }

  const scaffoldConfig = await resolveScaffoldConfig(parsedArgs);
  await applyScaffoldConfig(scaffoldConfig);
}
