import { chmod, mkdir, readdir, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ProjectFile } from '@axi/scaffold-kit';

const SAFE_EXISTING_ENTRIES = new Set(['.git', '.gitignore', '.DS_Store']);

export async function ensureTargetDirectoryIsSafe(targetDir: string): Promise<void> {
  try {
    const targetStats = await stat(targetDir);

    if (!targetStats.isDirectory()) {
      throw new Error(`Target path is not a directory: ${targetDir}`);
    }

    const entries = await readdir(targetDir);
    const blockedEntries = entries.filter((entry) => !SAFE_EXISTING_ENTRIES.has(entry));

    if (blockedEntries.length > 0) {
      throw new Error(
        `Target directory must be empty before scaffolding. Found: ${blockedEntries.join(', ')}`,
      );
    }
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === 'ENOENT') {
      return;
    }

    throw error;
  }
}

export async function writeProjectFiles(targetDir: string, files: ProjectFile[]): Promise<void> {
  for (const file of files) {
    const outputPath = path.join(targetDir, file.path);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, file.content, 'utf8');

    if (file.executable) {
      await chmod(outputPath, 0o755);
    }
  }
}

function resolveManagedPath(targetDir: string, relativePath: string): string {
  const absoluteTargetDir = path.resolve(targetDir);
  const absoluteManagedPath = path.resolve(targetDir, relativePath);

  if (
    absoluteManagedPath !== absoluteTargetDir &&
    !absoluteManagedPath.startsWith(`${absoluteTargetDir}${path.sep}`)
  ) {
    throw new Error(`Managed path escaped the target directory: ${relativePath}`);
  }

  return absoluteManagedPath;
}

async function pruneEmptyParentDirectories(targetDir: string, startingPath: string): Promise<void> {
  const absoluteTargetDir = path.resolve(targetDir);
  let currentDirectory = path.dirname(startingPath);

  while (currentDirectory.startsWith(absoluteTargetDir) && currentDirectory !== absoluteTargetDir) {
    const entries = await readdir(currentDirectory);

    if (entries.length > 0) {
      return;
    }

    await rmdir(currentDirectory);
    currentDirectory = path.dirname(currentDirectory);
  }
}

export async function removeStaleManagedFiles(
  targetDir: string,
  previousManagedFiles: string[],
  nextManagedFiles: string[],
): Promise<void> {
  const nextManagedFileSet = new Set(nextManagedFiles);
  const staleManagedFiles = previousManagedFiles.filter(
    (managedFile) => !nextManagedFileSet.has(managedFile),
  );

  for (const staleManagedFile of staleManagedFiles) {
    const absoluteManagedPath = resolveManagedPath(targetDir, staleManagedFile);

    try {
      const entryStats = await stat(absoluteManagedPath);

      if (!entryStats.isFile()) {
        continue;
      }

      await rm(absoluteManagedPath, { force: true });
      await pruneEmptyParentDirectories(targetDir, absoluteManagedPath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        continue;
      }

      throw error;
    }
  }
}

export async function listRelativeFiles(rootDir: string, currentDir = rootDir): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files: string[] = [];

  const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of sortedEntries) {
    const absolutePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(rootDir, absolutePath)));
      continue;
    }

    files.push(path.relative(rootDir, absolutePath).split(path.sep).join('/'));
  }

  return files.sort((left, right) => left.localeCompare(right));
}
