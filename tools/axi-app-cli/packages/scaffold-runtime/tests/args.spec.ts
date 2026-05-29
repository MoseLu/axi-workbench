import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseCliArgs } from '@axi/scaffold-runtime';

describe('parseCliArgs', () => {
  it('parses init mode with cwd overrides', () => {
    const parsed = parseCliArgs(
      ['init', '--yes', '--feature', 'theme-preset,ui-components', '--cwd', 'demo'],
      'F:/workspace',
      'axi',
    );

    expect(parsed).toMatchObject({
      command: 'init',
      cwd: path.resolve('F:/workspace', 'demo'),
      featureIds: ['theme-preset', 'ui-components'],
      install: true,
      template: 'default',
      verify: true,
      yes: true,
    });
  });

  it('parses create mode from the create-axi-app binary name', () => {
    const parsed = parseCliArgs(['demo', '--yes', '--no-install'], 'F:/workspace', 'create-axi-app');

    expect(parsed).toMatchObject({
      command: 'create',
      projectName: 'demo',
      install: false,
      verify: false,
      yes: true,
    });
  });

  it('rejects conflicting prompt modes', () => {
    expect(() => parseCliArgs(['init', '--yes', '--interactive'], 'F:/workspace', 'axi')).toThrow(
      'Choose either --yes or --interactive, not both.',
    );
  });

  it('requires a project name for create mode', () => {
    expect(() => parseCliArgs(['create'], 'F:/workspace', 'axi')).toThrow(
      /A project name is required/,
    );
  });

  it('parses add mode with positional feature ids', () => {
    const parsed = parseCliArgs(['add', 'theme-preset', 'hooks-pack', '--cwd', 'demo'], 'F:/workspace', 'axi');

    expect(parsed).toMatchObject({
      command: 'add',
      cwd: path.resolve('F:/workspace', 'demo'),
      featureIds: ['theme-preset', 'hooks-pack'],
    });
  });

  it('parses sync mode without requiring feature ids', () => {
    const parsed = parseCliArgs(['sync', '--cwd', 'demo'], 'F:/workspace', 'axi');

    expect(parsed).toMatchObject({
      command: 'sync',
      cwd: path.resolve('F:/workspace', 'demo'),
      featureIds: [],
    });
  });

  it('parses list mode without requiring feature ids', () => {
    const parsed = parseCliArgs(['list', '--cwd', 'demo'], 'F:/workspace', 'axi');

    expect(parsed).toMatchObject({
      command: 'list',
      cwd: path.resolve('F:/workspace', 'demo'),
      featureIds: [],
    });
  });

  it('parses doctor mode without requiring feature ids', () => {
    const parsed = parseCliArgs(['doctor', '--cwd', 'demo'], 'F:/workspace', 'axi');

    expect(parsed).toMatchObject({
      command: 'doctor',
      cwd: path.resolve('F:/workspace', 'demo'),
      featureIds: [],
    });
  });

  it('parses json and fix flags for doctor mode', () => {
    const parsed = parseCliArgs(['doctor', '--json', '--fix', '--cwd', 'demo'], 'F:/workspace', 'axi');

    expect(parsed).toMatchObject({
      command: 'doctor',
      cwd: path.resolve('F:/workspace', 'demo'),
      fix: true,
      json: true,
    });
  });

  it('rejects json outside list and doctor', () => {
    expect(() => parseCliArgs(['sync', '--json'], 'F:/workspace', 'axi')).toThrow(
      /--json flag is only supported for list and doctor/,
    );
  });

  it('rejects fix outside doctor', () => {
    expect(() => parseCliArgs(['list', '--fix'], 'F:/workspace', 'axi')).toThrow(
      /--fix flag is only supported for doctor/,
    );
  });
});
