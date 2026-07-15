/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  // The transform cache uses write-file-atomic/signal-exit, which is
  // incompatible with very recent Node runtimes (onExit is not a function).
  // Disabling the on-disk cache keeps the suite runnable across Node versions.
  cache: false,
};
