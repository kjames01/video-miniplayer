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
    './src/main/ipcHandlers.ts': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80
    },
    './src/main/windowManager.ts': {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70
    }
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  moduleNameMapper: {
    '^electron$': '<rootDir>/src/__mocks__/electron.ts',
    '^koffi$': '<rootDir>/src/__mocks__/koffi.ts'
  }
};
