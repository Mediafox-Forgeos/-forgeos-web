#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';

import { createPackage } from './commands/create-package.js';

// packages/forge-cli/{src,dist}/cli.ts -> repo root is two levels up.
const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

const program = new Command();

program
  .name('forge')
  .description('MediaFOX Forge internal scaffolding CLI')
  .version('0.1.0');

const packageCmd = program
  .command('package')
  .description('Manage workspace packages under packages/*');

packageCmd
  .command('create <name>')
  .description(
    'Scaffold a new packages/<name> following existing repo conventions',
  )
  .option(
    '-d, --description <text>',
    'One-line description for package.json/README',
  )
  .action(async (name: string, opts: { description?: string }) => {
    try {
      const result = await createPackage(name, workspaceRoot, {
        description: opts.description,
      });
      const relDir = path.relative(workspaceRoot, result.packageDir);
      console.log(`Created ${relDir}/`);
      for (const file of result.files) {
        console.log(`  ${relDir}/${file}`);
      }
      console.log('\nNext steps:');
      console.log('  pnpm install');
      console.log(`  pnpm --filter @mediafox/${name} typecheck`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
