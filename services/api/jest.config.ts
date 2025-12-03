import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  moduleNameMapper: {
    '^@wallet/common(.*)$': '<rootDir>/../..//libs/common/src$1',
    '^@wallet/db-orm(.*)$': '<rootDir>/../..//libs/db-orm/src$1',
  },
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};

export default config;
