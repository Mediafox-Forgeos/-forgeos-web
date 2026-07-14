import { FlatCompat } from '@eslint/eslintrc';
import { ignoredBuildDirectories } from '@mediafox/eslint-config';
import { globalIgnores } from 'eslint/config';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({
  baseDirectory: fileURLToPath(new URL('.', import.meta.url)),
});

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  globalIgnores([...ignoredBuildDirectories, 'next-env.d.ts']),
];

export default config;
