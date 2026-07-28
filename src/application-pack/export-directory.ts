import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const FILENAME = 'export-directory.txt';

export function readExportDirectory(workspaceRoot: string): string | null {
  const path = join(workspaceRoot, FILENAME);
  if (!existsSync(path)) return null;
  const value = readFileSync(path, 'utf-8').trim();
  return value || null;
}

export function writeExportDirectory(
  workspaceRoot: string,
  directory: string
): void {
  writeFileSync(join(workspaceRoot, FILENAME), directory.trim() + '\n', 'utf-8');
}
