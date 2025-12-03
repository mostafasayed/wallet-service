export function createMockRepo() {
    return {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((dto) => dto),
      count: jest.fn(),
    };
  }
  
  export function createMockDataSource(manager: any) {
    const ds: Partial<any> = {
      transaction: jest.fn(async (cb) => cb(manager)),
    };
    return ds as any;
  }
  