import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createPackage } from '../commands/create-package.js';

describe('createPackage', () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(path.join(tmpdir(), 'forge-cli-test-'));
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('scaffolds package.json, tsconfig.json, README.md and src/index.ts', async () => {
    const result = await createPackage('billing-core', workspaceRoot);

    expect(result.files.sort()).toEqual(
      [
        'package.json',
        'tsconfig.json',
        'README.md',
        path.join('src', 'index.ts'),
      ].sort(),
    );

    const pkgJson = JSON.parse(
      await readFile(path.join(result.packageDir, 'package.json'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(pkgJson.name).toBe('@mediafox/billing-core');
    expect(pkgJson.private).toBe(true);
    expect(pkgJson.type).toBe('module');
    expect(pkgJson.exports).toEqual({ '.': './dist/index.js' });
    expect(pkgJson.scripts).toEqual({
      build: 'tsc -p tsconfig.json',
      typecheck: 'tsc -p tsconfig.json --noEmit',
    });
    expect(pkgJson.devDependencies).toEqual({
      '@mediafox/typescript-config': 'workspace:*',
      typescript: '^5.7.2',
    });

    const tsconfig = await readFile(
      path.join(result.packageDir, 'tsconfig.json'),
      'utf-8',
    );
    expect(tsconfig).toContain('@mediafox/typescript-config/base.json');

    const indexTs = await readFile(
      path.join(result.packageDir, 'src', 'index.ts'),
      'utf-8',
    );
    expect(indexTs).toContain('@mediafox/billing-core');
  });

  it('includes the description in package.json and README when provided', async () => {
    const result = await createPackage('billing-core', workspaceRoot, {
      description: 'Shared billing domain types',
    });

    const pkgJson = JSON.parse(
      await readFile(path.join(result.packageDir, 'package.json'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(pkgJson.description).toBe('Shared billing domain types');

    const readme = await readFile(
      path.join(result.packageDir, 'README.md'),
      'utf-8',
    );
    expect(readme).toContain('Shared billing domain types');
  });

  it('rejects names that are not lowercase kebab-case', async () => {
    await expect(createPackage('BillingCore', workspaceRoot)).rejects.toThrow(
      /kebab-case/,
    );
    await expect(createPackage('billing_core', workspaceRoot)).rejects.toThrow(
      /kebab-case/,
    );
    await expect(createPackage('-billing', workspaceRoot)).rejects.toThrow(
      /kebab-case/,
    );
  });

  it('refuses to overwrite an existing package directory', async () => {
    await createPackage('billing-core', workspaceRoot);
    await expect(createPackage('billing-core', workspaceRoot)).rejects.toThrow(
      /already exists/,
    );
  });
});
