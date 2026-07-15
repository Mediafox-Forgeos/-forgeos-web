import tseslint from 'typescript-eslint';
import { globalIgnores } from 'eslint/config';

const config = [
  ...tseslint.configs.recommended,
  globalIgnores(['dist/**', 'node_modules/**']),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];

export default config;
