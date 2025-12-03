import { jest } from '@jest/globals';
import { DataSource } from 'typeorm';

export function createMockRepo() {
  return {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn(async (entity) => entity),
    count: jest.fn(),
  };
}

export function createMockDataSource(manager: any): DataSource {
    const mock: Partial<DataSource> = {
      transaction: jest.fn(async (cb: any) => cb(manager)),
    };
  
    return mock as DataSource;
  }
