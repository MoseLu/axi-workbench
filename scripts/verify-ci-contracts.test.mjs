import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';

// Inline the script logic to test it directly without file system dependencies
const required = (value, label) => {
  if (!value) throw new Error(`missing ${label}`);
};

const validatePackageJson = (packageJson) => {
  for (const name of ['build', 'type-check', 'test', 'verify:ci']) {
    required(packageJson.scripts?.[name], `root script ${name}`);
  }
};

const validateTurbo = (turbo) => {
  const tasks = turbo.tasks ?? turbo.pipeline;
  for (const name of ['build', 'type-check', 'test']) {
    required(tasks?.[name], `turbo task ${name}`);
  }
};

const validateWorkspace = (workspace) => {
  required(workspace.includes('packages'), 'workspace package declaration');
};

const validateWorkflow = (workflow) => {
  const hasInstall = workflow.includes('pnpm install --frozen-lockfile') || workflow.includes('pnpm install --frozen-lockfile=false');
  const hasVerifyCi = workflow.includes('pnpm verify:ci');
  const hasTypeCheck = workflow.includes('pnpm type-check') || (workflow.includes('run_if_script') && workflow.includes('type-check'));
  const hasTest = workflow.includes('pnpm test') || (workflow.includes('run_if_script') && workflow.includes('test'));
  const hasBuild = workflow.includes('pnpm build') || (workflow.includes('run_if_script') && workflow.includes('build'));
  required(hasInstall, 'workflow command pnpm install');
  required(hasVerifyCi, 'workflow command pnpm verify:ci');
  required(hasTypeCheck, 'workflow command pnpm type-check');
  required(hasTest, 'workflow command pnpm test');
  required(hasBuild, 'workflow command pnpm build');
};

describe('verify-ci-contracts', () => {
  describe('package.json validation', () => {
    it('accepts valid package.json with all required scripts', () => {
      const pkg = {
        scripts: {
          build: 'turbo build',
          'type-check': 'turbo type-check',
          test: 'turbo test',
          'verify:ci': 'turbo verify:ci'
        }
      };
      validatePackageJson(pkg);
    });

    it('accepts package.json with additional scripts', () => {
      const pkg = {
        scripts: {
          build: 'turbo build',
          'type-check': 'turbo type-check',
          test: 'turbo test',
          'verify:ci': 'turbo verify:ci',
          lint: 'eslint .',
          format: 'prettier --write .'
        }
      };
      validatePackageJson(pkg);
    });

    it('rejects package.json missing build script', () => {
      const pkg = {
        scripts: {
          'type-check': 'turbo type-check',
          test: 'turbo test',
          'verify:ci': 'turbo verify:ci'
        }
      };
      assert.throws(() => validatePackageJson(pkg), /missing root script build/);
    });

    it('rejects package.json missing type-check script', () => {
      const pkg = {
        scripts: {
          build: 'turbo build',
          test: 'turbo test',
          'verify:ci': 'turbo verify:ci'
        }
      };
      assert.throws(() => validatePackageJson(pkg), /missing root script type-check/);
    });

    it('rejects package.json missing test script', () => {
      const pkg = {
        scripts: {
          build: 'turbo build',
          'type-check': 'turbo type-check',
          'verify:ci': 'turbo verify:ci'
        }
      };
      assert.throws(() => validatePackageJson(pkg), /missing root script test/);
    });

    it('rejects package.json missing verify:ci script', () => {
      const pkg = {
        scripts: {
          build: 'turbo build',
          'type-check': 'turbo type-check',
          test: 'turbo test'
        }
      };
      assert.throws(() => validatePackageJson(pkg), /missing root script verify:ci/);
    });

    it('rejects package.json with no scripts', () => {
      const pkg = {};
      assert.throws(() => validatePackageJson(pkg), /missing root script build/);
    });

    it('rejects package.json with empty scripts', () => {
      const pkg = { scripts: {} };
      assert.throws(() => validatePackageJson(pkg), /missing root script build/);
    });
  });

  describe('turbo.json validation', () => {
    it('accepts valid turbo.json with tasks using tasks key', () => {
      const turbo = {
        tasks: {
          build: {},
          'type-check': {},
          test: {}
        }
      };
      validateTurbo(turbo);
    });

    it('accepts valid turbo.json with tasks using pipeline key', () => {
      const turbo = {
        pipeline: {
          build: {},
          'type-check': {},
          test: {}
        }
      };
      validateTurbo(turbo);
    });

    it('accepts turbo.json with additional tasks', () => {
      const turbo = {
        tasks: {
          build: {},
          'type-check': {},
          test: {},
          lint: {},
          dev: {}
        }
      };
      validateTurbo(turbo);
    });

    it('rejects turbo.json missing build task', () => {
      const turbo = {
        tasks: {
          'type-check': {},
          test: {}
        }
      };
      assert.throws(() => validateTurbo(turbo), /missing turbo task build/);
    });

    it('rejects turbo.json missing type-check task', () => {
      const turbo = {
        tasks: {
          build: {},
          test: {}
        }
      };
      assert.throws(() => validateTurbo(turbo), /missing turbo task type-check/);
    });

    it('rejects turbo.json missing test task', () => {
      const turbo = {
        tasks: {
          build: {},
          'type-check': {}
        }
      };
      assert.throws(() => validateTurbo(turbo), /missing turbo task test/);
    });

    it('rejects turbo.json with empty tasks', () => {
      const turbo = { tasks: {} };
      assert.throws(() => validateTurbo(turbo), /missing turbo task build/);
    });

    it('rejects turbo.json with no tasks or pipeline', () => {
      const turbo = {};
      assert.throws(() => validateTurbo(turbo), /missing turbo task build/);
    });
  });

  describe('pnpm-workspace.yaml validation', () => {
    it('accepts valid workspace with packages declaration', () => {
      const workspace = 'packages:\n  - "packages/*"';
      validateWorkspace(workspace);
    });

    it('accepts workspace with packages in different position', () => {
      const workspace = 'someConfig: true\npackages:\n  - "packages/*"\notherConfig: false';
      validateWorkspace(workspace);
    });

    it('rejects workspace without packages declaration', () => {
      const workspace = 'only: "some/path"';
      assert.throws(() => validateWorkspace(workspace), /missing workspace package declaration/);
    });

    it('rejects empty workspace content', () => {
      const workspace = '';
      assert.throws(() => validateWorkspace(workspace), /missing workspace package declaration/);
    });
  });

  describe('CI workflow validation', () => {
    it('accepts workflow with frozen-lockfile install pattern', () => {
      const workflow = `
        steps:
          - run: pnpm install --frozen-lockfile
          - run: pnpm verify:ci
          - run: pnpm type-check
          - run: pnpm test
          - run: pnpm build
      `;
      validateWorkflow(workflow);
    });

    it('accepts workflow with frozen-lockfile=false install pattern', () => {
      const workflow = `
        steps:
          - run: pnpm install --frozen-lockfile=false
          - run: pnpm verify:ci
          - run: pnpm type-check
          - run: pnpm test
          - run: pnpm build
      `;
      validateWorkflow(workflow);
    });

    it('accepts workflow using run_if_script pattern for type-check', () => {
      const workflow = `
        steps:
          - run: pnpm install --frozen-lockfile
          - run: pnpm verify:ci
          - name: type-check
            run_if_script: type-check
          - run: pnpm test
          - run: pnpm build
      `;
      validateWorkflow(workflow);
    });

    it('accepts workflow using run_if_script pattern for test', () => {
      const workflow = `
        steps:
          - run: pnpm install --frozen-lockfile
          - run: pnpm verify:ci
          - run: pnpm type-check
          - name: test
            run_if_script: test
          - run: pnpm build
      `;
      validateWorkflow(workflow);
    });

    it('accepts workflow using run_if_script pattern for build', () => {
      const workflow = `
        steps:
          - run: pnpm install --frozen-lockfile
          - run: pnpm verify:ci
          - run: pnpm type-check
          - run: pnpm test
          - name: build
            run_if_script: build
      `;
      validateWorkflow(workflow);
    });

    it('rejects workflow missing install command', () => {
      const workflow = `
        steps:
          - run: pnpm verify:ci
          - run: pnpm type-check
          - run: pnpm test
          - run: pnpm build
      `;
      assert.throws(() => validateWorkflow(workflow), /missing workflow command pnpm install/);
    });

    it('rejects workflow missing verify:ci command', () => {
      const workflow = `
        steps:
          - run: pnpm install --frozen-lockfile
          - run: pnpm type-check
          - run: pnpm test
          - run: pnpm build
      `;
      assert.throws(() => validateWorkflow(workflow), /missing workflow command pnpm verify:ci/);
    });

    it('rejects workflow missing type-check', () => {
      const workflow = `
        steps:
          - run: pnpm install --frozen-lockfile
          - run: pnpm verify:ci
          - run: pnpm test
          - run: pnpm build
      `;
      assert.throws(() => validateWorkflow(workflow), /missing workflow command pnpm type-check/);
    });

    it('rejects workflow missing test', () => {
      const workflow = `
        steps:
          - run: pnpm install --frozen-lockfile
          - run: pnpm verify:ci
          - run: pnpm type-check
          - run: pnpm build
      `;
      assert.throws(() => validateWorkflow(workflow), /missing workflow command pnpm test/);
    });

    it('rejects workflow missing build', () => {
      const workflow = `
        steps:
          - run: pnpm install --frozen-lockfile
          - run: pnpm verify:ci
          - run: pnpm type-check
          - run: pnpm test
      `;
      assert.throws(() => validateWorkflow(workflow), /missing workflow command pnpm build/);
    });

    it('rejects workflow with empty content', () => {
      const workflow = '';
      assert.throws(() => validateWorkflow(workflow), /missing workflow command pnpm install/);
    });
  });

  describe('full integration', () => {
    it('accepts fully valid contract files', () => {
      const pkg = {
        scripts: {
          build: 'turbo build',
          'type-check': 'turbo type-check',
          test: 'turbo test',
          'verify:ci': 'turbo verify:ci'
        }
      };
      const turbo = {
        tasks: {
          build: {},
          'type-check': {},
          test: {}
        }
      };
      const workspace = 'packages:\n  - "packages/*"';
      const workflow = `
        steps:
          - run: pnpm install --frozen-lockfile
          - run: pnpm verify:ci
          - run: pnpm type-check
          - run: pnpm test
          - run: pnpm build
      `;

      validatePackageJson(pkg);
      validateTurbo(turbo);
      validateWorkspace(workspace);
      validateWorkflow(workflow);
    });
  });
});
