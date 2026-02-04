/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**'
  ],
  coverageThreshold: {
    './src/main/urlCache.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100
    },
    './src/main/localServer.ts': {
      statements: 90,
      branches: 80,
      functions: 85,
      lines: 90
    }
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  // Mock Electron by default
  moduleNameMapper: {
    '^electron$': '<rootDir>/src/__mocks__/electron.ts'
  }
};
