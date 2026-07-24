import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  indexTs,
  packageJson,
  readmeMd,
  tsconfigJson,
} from '../templates/package.js';

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export interface CreatePackageOptions {
  description?: string;
}

export interface CreatePackageResult {
  packageDir: string;
  files: string[];
}

/**
 * Scaffolds packages/<name> following the exact convention already set by
 * packages/core-domain and packages/shared-types: type:module, dist-based
 * exports, tsconfig extending @mediafox/typescript-config/base.json.
 *
 * Pure filesystem side effect, no pnpm/git invocation — the caller (CLI
 * entry point) is responsible for printing next-step instructions, and
 * tests exercise this function directly against a temp directory instead
 * of the real repo tree.
 */
export async function createPackage(
  name: string,
  workspaceRoot: string,
  options: CreatePackageOptions = {},
): Promise<CreatePackageResult> {
  if (!KEBAB_CASE.test(name)) {
    throw new Error(
      `"${name}" is not a valid package name — use lowercase kebab-case (e.g. "billing-core"), matching every existing package under packages/.`,
    );
  }

  const packageDir = path.join(workspaceRoot, 'packages', name);
  if (existsSync(packageDir)) {
    throw new Error(`packages/${name} already exists.`);
  }

  await mkdir(path.join(packageDir, 'src'), { recursive: true });

  const description = options.description ?? '';
  const files: Array<[string, string]> = [
    ['package.json', packageJson(name, description)],
    ['tsconfig.json', tsconfigJson()],
    ['README.md', readmeMd(name, description)],
    [path.join('src', 'index.ts'), indexTs(name)],
  ];

  for (const [relativePath, content] of files) {
    await writeFile(path.join(packageDir, relativePath), content, 'utf-8');
  }

  return { packageDir, files: files.map(([relativePath]) => relativePath) };
}
