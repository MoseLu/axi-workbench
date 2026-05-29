import path from 'node:path';

import { z } from 'zod';

import type { CommandName, ParsedArgs, TemplateName } from '@axi/scaffold-kit';

const templateSchema = z.literal('default');

function readOptionValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];

  if (!value || value.startsWith('-')) {
    throw new Error(`Expected a value after ${option}.`);
  }

  return value;
}

function mergeFeatureIds(existingFeatureIds: string[], rawValue: string): string[] {
  const incomingFeatureIds = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return [...existingFeatureIds, ...incomingFeatureIds];
}

export function renderUsage(invokedName: string): string {
  const normalizedName = path.basename(invokedName);

  return [
    'Usage:',
    `  ${normalizedName === 'create-axi-app' ? 'create-axi-app <name>' : 'axi init'} [options]`,
    '  axi create <name> [options]',
    '  axi add <feature-id> [more-feature-ids] [options]',
    '  axi sync [options]',
    '  axi list [options]',
    '  axi doctor [options]',
    '',
    'Options:',
    '  --feature <id>  Enable an extension or experimental module. Repeat the flag or pass a comma-separated list',
    '  --json          Emit structured JSON output for list or doctor',
    '  --fix           Let doctor attempt a safe scaffold repair before reporting',
    '  --yes           Use the recommended defaults without prompts',
    '  --interactive   Force interactive confirmations when a TTY is available',
    '  --no-install    Skip dependency installation and verification',
    '  --no-verify     Skip post-generation verification',
    '  --cwd <path>    Override the working directory used for generation',
    '  --template      Template name. Only "default" is supported in v1',
    '  -h, --help      Show help',
    '  -v, --version   Show the CLI version',
  ].join('\n');
}

export function parseCliArgs(argv: string[], cwd: string, invokedName: string): ParsedArgs {
  let command: CommandName | undefined;
  let projectName: string | undefined;
  let cursor = 0;

  if (path.basename(invokedName) === 'create-axi-app') {
    command = 'create';

    if (argv[0] && !argv[0].startsWith('-')) {
      projectName = argv[0];
      cursor = 1;
    }
  } else {
    const firstArg = argv[0];

    if (!firstArg || firstArg === 'init') {
      command = 'init';
      cursor = firstArg ? 1 : 0;
    } else if (firstArg === 'create') {
      command = 'create';
      cursor = 1;

      if (argv[1] && !argv[1].startsWith('-')) {
        projectName = argv[1];
        cursor = 2;
      }
    } else if (firstArg === 'add') {
      command = 'add';
      cursor = 1;
    } else if (firstArg === 'sync') {
      command = 'sync';
      cursor = 1;
    } else if (firstArg === 'list') {
      command = 'list';
      cursor = 1;
    } else if (firstArg === 'doctor') {
      command = 'doctor';
      cursor = 1;
    } else if (!firstArg.startsWith('-')) {
      throw new Error(`Unknown command "${firstArg}".\n\n${renderUsage(invokedName)}`);
    } else {
      command = 'init';
    }
  }

  let yes = false;
  let interactive = false;
  let install = true;
  let verify = true;
  let json = false;
  let fix = false;
  let template: TemplateName = 'default';
  let workingDirectory = cwd;
  let featureIds: string[] = [];

  for (let index = cursor; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case '--feature':
        featureIds = mergeFeatureIds(featureIds, readOptionValue(argv, index, argument));
        index += 1;
        break;
      case '--json':
        json = true;
        break;
      case '--fix':
        fix = true;
        break;
      case '--yes':
        yes = true;
        break;
      case '--interactive':
        interactive = true;
        break;
      case '--no-install':
        install = false;
        verify = false;
        break;
      case '--no-verify':
        verify = false;
        break;
      case '--cwd':
        workingDirectory = path.resolve(cwd, readOptionValue(argv, index, argument));
        index += 1;
        break;
      case '--template':
        template = templateSchema.parse(readOptionValue(argv, index, argument));
        index += 1;
        break;
      default:
        if (command === 'create' && !projectName && !argument.startsWith('-')) {
          projectName = argument;
          break;
        }

        if (command === 'add' && !argument.startsWith('-')) {
          featureIds = mergeFeatureIds(featureIds, argument);
          break;
        }

        throw new Error(`Unknown option "${argument}".\n\n${renderUsage(invokedName)}`);
    }
  }

  if (yes && interactive) {
    throw new Error('Choose either --yes or --interactive, not both.');
  }

  if (command === 'create' && !projectName) {
    throw new Error(`A project name is required.\n\n${renderUsage(invokedName)}`);
  }

  if (command === 'add' && featureIds.length === 0) {
    throw new Error(`At least one feature id is required for add.\n\n${renderUsage(invokedName)}`);
  }

  if (json && command !== 'list' && command !== 'doctor') {
    throw new Error(`The --json flag is only supported for list and doctor.\n\n${renderUsage(invokedName)}`);
  }

  if (fix && command !== 'doctor') {
    throw new Error(`The --fix flag is only supported for doctor.\n\n${renderUsage(invokedName)}`);
  }

  return {
    command,
    cwd: workingDirectory,
    featureIds,
    fix,
    install,
    interactive,
    invokedName,
    json,
    projectName,
    template,
    verify,
    yes,
  };
}
