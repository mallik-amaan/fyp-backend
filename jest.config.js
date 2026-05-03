module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup.js'],
  clearMocks: true,
  collectCoverageFrom: ['routes/**/*.js', 'config/middleware/**/*.js'],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  testTimeout: 15000,
  // HTML test-results report (pass/fail per test case)
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './reports',
      filename: 'test-report.html',
      pageTitle: 'DocSynth Backend Test Report',
      includeFailureMsg: true,
      includeConsoleLog: false,
      expand: true,
    }],
  ],
};
