import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { listRelativeFiles } from '@axi/scaffold-runtime';

export async function createTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function disposeTempDir(tempDir: string): Promise<void> {
  await rm(tempDir, { force: true, recursive: true });
}

export async function readText(filePath: string): Promise<string> {
  return readFile(filePath, 'utf8');
}

export { listRelativeFiles };
