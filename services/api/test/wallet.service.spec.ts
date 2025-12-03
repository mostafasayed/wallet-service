import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  WalletEntity,
  EventEntity,
  OperationEntity,
  TransferEntity,
  WalletStatsEntity,
} from '@wallet/db-orm';
import {
  EventType,
  OperationType,
  TransferStatus,
} from '@wallet/common';
import { WalletService } from '../src/wallet/wallet.service';
import { createMockRepo, createMockDataSource } from './mocks';
import { DataSource, Repository } from 'typeorm';
import { RabbitMqService } from '../src/messaging/rabbitmq.service';

describe('WalletService', () => {
  let service: WalletService;
  let walletRepo: jest.Mocked<Repository<WalletEntity>>;
  let eventRepo: jest.Mocked<Repository<EventEntity>>;
  let operationRepo: jest.Mocked<Repository<OperationEntity>>;
  let transferRepo: jest.Mocked<Repository<TransferEntity>>;
  let walletStatsRepo: jest.Mocked<Repository<WalletStatsEntity>>;
  let rabbitMq: { publishWalletEvent: jest.Mock };

  // manager used inside dataSource.transaction
  const manager: any = {
    findOne: jest.fn(),
    create: jest.fn((entity: any, dto: any) => {
      if (entity === EventEntity) {
        return {
          id: dto.id ?? 'event-id-mock',
          createdAt: dto.createdAt ?? new Date(),
          ...dto,
        };
      }
      return dto;
    }),
    save: jest.fn(async (entity: any) => entity),
  };

  beforeEach(async () => {
    walletRepo = createMockRepo() as any;
    eventRepo = createMockRepo() as any;
    operationRepo = createMockRepo() as any;
    transferRepo = createMockRepo() as any;
    walletStatsRepo = createMockRepo() as any;
    rabbitMq = {
      publishWalletEvent: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: getRepositoryToken(WalletEntity), useValue: walletRepo },
        { provide: getRepositoryToken(EventEntity), useValue: eventRepo },
        { provide: getRepositoryToken(OperationEntity), useValue: operationRepo },
        { provide: getRepositoryToken(TransferEntity), useValue: transferRepo },
        { provide: getRepositoryToken(WalletStatsEntity), useValue: walletStatsRepo },
        { provide: DataSource, useValue: createMockDataSource(manager) },
        { provide: RabbitMqService, useValue: rabbitMq },
      ],
    }).compile();

    service = moduleRef.get(WalletService);
    jest.clearAllMocks();
  });

  describe('deposit', () => {
    it('creates a new wallet and emits WalletCreated event on first deposit', async () => {
      // manager.findOne: wallet not found initially
      manager.findOne.mockResolvedValueOnce(null);

      const result = await service.deposit('wallet-1', 100, 'req-1');

      // wallet created
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'wallet-1',
          balance: '100.0000',
        }),
      );

      // event created with WalletCreated
      expect(manager.create).toHaveBeenCalledWith(EventEntity, expect.anything());
      const eventCall = manager.create.mock.calls.find(
        (call: any[]) => call[0] === EventEntity,
      );
      expect(eventCall?.[1].type).toBe(EventType.WalletCreated);

      // operation created
      const opCall = manager.create.mock.calls.find(
        (call: any[]) => call[0] === OperationEntity
      );
      expect(opCall?.[1].type).toBe(OperationType.Deposit);

      // response snapshot
      expect(result).toEqual({
        balance: '100.0000',
        created: true,
      });

      // publishWalletEvent called once
      expect(rabbitMq.publishWalletEvent).toHaveBeenCalledTimes(1);
    });

    it('is idempotent for same requestId', async () => {
      // existing operation with responseSnapshot
      operationRepo.findOne.mockResolvedValueOnce({
        requestId: 'req-1',
        walletId: 'wallet-1',
        success: true,
        responseSnapshot: { balance: '150.0000', created: false },
      } as any);

      const result = await service.deposit('wallet-1', 100, 'req-1');

      // no transaction called (manager not used)
      expect(manager.findOne).not.toHaveBeenCalled();
      expect(result).toEqual({
        balance: '150.0000',
        created: false,
      });
      expect(rabbitMq.publishWalletEvent).not.toHaveBeenCalled();
    });
  });

  describe('withdraw', () => {
    it('withdraws successfully when sufficient balance', async () => {
      // no existing op
      operationRepo.findOne.mockResolvedValueOnce(null);

      // manager.findOne: wallet exists with balance 200
      manager.findOne.mockResolvedValueOnce({
        id: 'wallet-1',
        balance: '200.0000',
      });

      const result = await service.withdraw('wallet-1', 50, 'req-w1');

      // new balance persisted
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'wallet-1',
          balance: '150.0000',
        }),
      );

      // event FundsWithdrawn created
      const eventCall = manager.create.mock.calls.find(
        (call: any[]) => call[0] === EventEntity,
      );
      expect(eventCall?.[1].type).toBe(EventType.FundsWithdrawn);

      // operation success created
      const opCall = manager.create.mock.calls.find(
        (call: any[]) => call[0] === OperationEntity,
      );
      expect(opCall?.[1].type).toBe(OperationType.Withdraw);

      expect(result).toEqual({
        balance: '150.0000',
        created: false,
      });

      expect(rabbitMq.publishWalletEvent).toHaveBeenCalledTimes(1);
    });

    it('fails when insufficient balance and records failed operation', async () => {
      // no existing op
      operationRepo.findOne.mockResolvedValueOnce(null);

      // wallet with low balance
      manager.findOne.mockResolvedValueOnce({
        id: 'wallet-1',
        balance: '10.0000',
      });

      await expect(
        service.withdraw('wallet-1', 50, 'req-w2'),
      ).rejects.toBeInstanceOf(BadRequestException);

      // failed operation saved
      const opCall = manager.create.mock.calls.find(
        (call: any[]) => call[0] === OperationEntity,
      );
      expect(opCall?.[1]).toEqual(
        expect.objectContaining({
          type: OperationType.Withdraw,
          success: false,
          errorMessage: 'Insufficient balance',
        }),
      );

      // no publish for failed op (with current implementation)
      expect(rabbitMq.publishWalletEvent).not.toHaveBeenCalled();
    });
  });

  describe('transfer', () => {
    it('returns idempotent result when transfer already completed', async () => {
      // existing completed transfer
      transferRepo.findOne.mockResolvedValueOnce({
        id: 'tr-1',
        status: TransferStatus.Completed,
        requestId: 'req-t1',
      } as any);

      walletRepo.findOne
        .mockResolvedValueOnce({ id: 'from', balance: '50.0000' } as any)
        .mockResolvedValueOnce({ id: 'to', balance: '150.0000' } as any);

      const result = await service.transfer('from', 'to', 50, 'req-t1');

      expect(result).toEqual({
        transferId: 'tr-1',
        status: TransferStatus.Completed,
        fromBalance: '50.0000',
        toBalance: '150.0000',
      });

      // debit/credit not called again (we could spy on private methods via any cast)
      expect(manager.findOne).not.toHaveBeenCalled();
      expect(rabbitMq.publishWalletEvent).not.toHaveBeenCalled();
    });

    it('rejects transfer to same wallet', async () => {
      await expect(
        service.transfer('same', 'same', 10, 'req-t2'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
