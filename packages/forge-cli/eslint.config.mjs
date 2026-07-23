import { globalIgnores } from 'eslint/config';

const config = [
  globalIgnores(['dist/**', 'node_modules/**']),
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];

export default config;
