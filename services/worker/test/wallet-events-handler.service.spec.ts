import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import {
  EventEntity,
  WalletStatsEntity,
  ProcessedEventEntity,
} from '@wallet/db-orm';

import { WalletEventsHandlerService } from '../src/handlers/wallet-events-handler.service';
import { createMockRepo, createMockDataSource } from './mocks';

import { WalletEventMessage, EventType } from '@wallet/common';
import { Repository, DataSource } from 'typeorm';

describe('WalletEventsHandlerService', () => {
  let handler: WalletEventsHandlerService;

  let eventRepo: jest.Mocked<Repository<EventEntity>>;
  let statsRepo: jest.Mocked<Repository<WalletStatsEntity>>;
  let processedRepo: jest.Mocked<Repository<ProcessedEventEntity>>;

  const manager: any = {
    getRepository: jest.fn(),
    save: jest.fn(async (x: any) => x),
  };

  beforeEach(async () => {
    eventRepo = createMockRepo() as any;
    statsRepo = createMockRepo() as any;
    processedRepo = createMockRepo() as any;

    manager.getRepository.mockImplementation((entity: any) => {
      if (entity === EventEntity) return eventRepo;
      if (entity === WalletStatsEntity) return statsRepo;
      if (entity === ProcessedEventEntity) return processedRepo;
      throw new Error('Unknown repo');
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        WalletEventsHandlerService,
        { provide: getRepositoryToken(EventEntity), useValue: eventRepo },
        { provide: getRepositoryToken(WalletStatsEntity), useValue: statsRepo },
        { provide: getRepositoryToken(ProcessedEventEntity), useValue: processedRepo },
        { provide: DataSource, useValue: createMockDataSource(manager) },
      ],
    }).compile();

    handler = moduleRef.get(WalletEventsHandlerService);
    jest.clearAllMocks();
  });

  it('aggregates deposits into wallet_stats', async () => {
    const msg: WalletEventMessage = {
      id: 'e1',
      type: EventType.FundsDeposited,
      occurredAt: new Date().toISOString(),
      payload: {
        walletId: 'w1',
        amount: 100,
        newBalance: 100,
        requestId: 'r-1',
      },
    };

    statsRepo.findOne.mockResolvedValueOnce(null);

    processedRepo.findOne.mockResolvedValueOnce(null);

    eventRepo.findOne.mockResolvedValueOnce({
      id: 'e1',
      walletId: 'w1',
      payload: msg.payload,
    } as any);

    await handler.handleEvent(msg);

    expect(statsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: 'w1',
        totalDeposited: '100.0000',
      }),
    );

    expect(processedRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'e1',
        status: 'success',
      }),
    );
  });

  it('flags suspicious wallet after 3 withdrawals in 60 seconds', async () => {
    const now = new Date().toISOString();

    const msg: WalletEventMessage = {
      id: 'e2',
      type: EventType.FundsWithdrawn,
      occurredAt: now,
      payload: {
        walletId: 'w2',
        amount: 50,
        newBalance: 50,
        requestId: 'r-2',
      },
    };

    processedRepo.findOne.mockResolvedValueOnce(null);
    statsRepo.findOne.mockResolvedValueOnce({
      walletId: 'w2',
      totalDeposited: '0',
      totalWithdrawn: '0',
      totalTransferredOut: '0',
      totalTransferredIn: '0',
      suspicious: false,
      suspiciousReason: null,
    } as any);

    eventRepo.findOne.mockResolvedValueOnce({
      id: 'e2',
      walletId: 'w2',
      payload: msg.payload,
    } as any);

    eventRepo.count.mockResolvedValueOnce(3);

    await handler.handleEvent(msg);

    expect(statsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        suspicious: true,
        suspiciousReason: expect.stringContaining('withdrawals'),
      }),
    );
  });

  it('is idempotent: skips event if already processed', async () => {
    processedRepo.findOne.mockResolvedValueOnce({
      eventId: 'e3',
      status: 'success',
    } as any);

    const msg: WalletEventMessage = {
      id: 'e3',
      type: EventType.FundsDeposited,
      occurredAt: new Date().toISOString(),
      payload: {
        walletId: 'w3',
        amount: 10,
        newBalance: 10,
        requestId: 'r3',
      },
    };

    await handler.handleEvent(msg);

    expect(statsRepo.save).not.toHaveBeenCalled();
    expect(processedRepo.save).not.toHaveBeenCalled();
  });
});
