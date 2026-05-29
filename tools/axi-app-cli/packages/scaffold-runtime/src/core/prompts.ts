import { confirm, input } from '@inquirer/prompts';

import { getInstallableFeatureSummaries } from '@axi/scaffold-registry';
import type { PromptState } from '@axi/scaffold-kit';

function recommendedOnlyMessage(label: string): string {
  return `${label} is fixed in v1. Re-run with the recommended defaults or wait for a future preset release.`;
}

export async function promptForScaffoldConfig(initialState: PromptState): Promise<PromptState> {
  const targetConfirmed = await confirm({
    default: true,
    message:
      initialState.command === 'create'
        ? `Create a new scaffold in "${initialState.targetDir}"?`
        : `Initialize the current directory "${initialState.targetDir}"?`,
  });

  if (!targetConfirmed) {
    throw new Error('Cancelled by user.');
  }

  const projectName = await input({
    default: initialState.projectName,
    message: 'Project name',
    validate: (value) => (value.trim().length > 0 ? true : 'Project name is required.'),
  });

  const frontendConfirmed = await confirm({
    default: true,
    message: 'Use the default frontend stack (Vite + React + TypeScript + Zod)?',
  });

  if (!frontendConfirmed) {
    throw new Error(recommendedOnlyMessage('The frontend stack'));
  }

  const backendConfirmed = await confirm({
    default: true,
    message: 'Use the default backend stack (Flask + pytest + feature-based modules)?',
  });

  if (!backendConfirmed) {
    throw new Error(recommendedOnlyMessage('The backend stack'));
  }

  const tokensConfirmed = await confirm({
    default: true,
    message: 'Use the default styling stack (Style Dictionary + SCSS tokens)?',
  });

  if (!tokensConfirmed) {
    throw new Error(recommendedOnlyMessage('The styling stack'));
  }

  const hooksConfirmed = await confirm({
    default: true,
    message: 'Enable the hooks preset (Git hooks baseline + code hooks conventions)?',
  });

  if (!hooksConfirmed) {
    throw new Error(recommendedOnlyMessage('The hooks preset'));
  }

  const selectedFeatureIds = [...initialState.featureIds];

  for (const installableFeature of getInstallableFeatureSummaries()) {
    const includeFeature = await confirm({
      default: selectedFeatureIds.includes(installableFeature.id),
      message: `Enable ${installableFeature.layer} module "${installableFeature.id}" (${installableFeature.title})?`,
    });

    if (includeFeature && !selectedFeatureIds.includes(installableFeature.id)) {
      selectedFeatureIds.push(installableFeature.id);
    }

    if (!includeFeature && selectedFeatureIds.includes(installableFeature.id)) {
      selectedFeatureIds.splice(selectedFeatureIds.indexOf(installableFeature.id), 1);
    }
  }

  const install = await confirm({
    default: initialState.install,
    message: 'Install dependencies after generation?',
  });

  const verify = install
    ? await confirm({
        default: initialState.verify,
        message: 'Run token build, tests, and smoke verification after install?',
      })
    : false;

  const readyToWrite = await confirm({
    default: true,
    message: [
      'Write the scaffold with these defaults?',
      `- name: ${projectName.trim()}`,
      `- installable modules: ${selectedFeatureIds.length > 0 ? selectedFeatureIds.join(', ') : 'none'}`,
      `- install dependencies: ${install ? 'yes' : 'no'}`,
      `- run verification: ${verify ? 'yes' : 'no'}`,
    ].join('\n'),
  });

  if (!readyToWrite) {
    throw new Error('Cancelled by user.');
  }

  return {
    ...initialState,
    featureIds: selectedFeatureIds,
    install,
    projectName: projectName.trim(),
    verify,
  };
}
