module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testTimeout: 30000,
  // Measure coverage across all source files, not just the ones a test
  // happens to require — otherwise untested files are simply absent from
  // the report instead of counting against the percentage.
  // server.js is just process bootstrap (dotenv + app.listen); it's never
  // required by the integration suite and isn't meaningfully unit-testable.
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text-summary'],
};