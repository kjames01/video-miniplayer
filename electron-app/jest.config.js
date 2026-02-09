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
    },
    './src/main/ytdlpManager.ts': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80
    },
    './src/main/ipcHandlers.ts': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80
    },
    './src/main/geminiService.ts': {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70
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
  // Mock Electron by default
  moduleNameMapper: {
    '^electron$': '<rootDir>/src/__mocks__/electron.ts'
  }
};
