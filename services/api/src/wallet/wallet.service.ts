import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  WalletEntity,
  EventEntity,
  OperationEntity,
  TransferEntity,
  WalletStatsEntity,
} from '@wallet/db-orm/entities';
import { Repository, DataSource, LessThan } from 'typeorm';

import { EventType } from '@wallet/common';
import { OperationType } from '@wallet/common';
import { TransferStatus } from '@wallet/common';
import { WalletEventMessage } from '@wallet/common';
import { RabbitMqService } from '../messaging/rabbitmq.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(WalletEntity)
    private readonly walletRepo: Repository<WalletEntity>,
    @InjectRepository(EventEntity)
    private readonly eventRepo: Repository<EventEntity>,
    @InjectRepository(OperationEntity)
    private readonly operationRepo: Repository<OperationEntity>,
    @InjectRepository(TransferEntity)
    private readonly transferRepo: Repository<TransferEntity>,
    @InjectRepository(WalletStatsEntity)
    private readonly statsRepo: Repository<WalletStatsEntity>,
    private readonly dataSource: DataSource,
    private readonly rabbitMq: RabbitMqService,
  ) { }

  async deposit(walletId: string, amount: number, requestId: string) {
    this.logger.log(`Depositing ${amount} to wallet ${walletId} with requestId ${requestId}`);

    const existingOp = await this.operationRepo.findOne({
      where: { requestId, walletId },
    });

    if (existingOp && existingOp.responseSnapshot) {
      return existingOp.responseSnapshot;
    }

    let eventToPublish: EventEntity | undefined;
    this.logger.debug(`Event to publish in deposit: ${JSON.stringify(eventToPublish)}`);

    const result = await this.dataSource.transaction(async (manager) => {
      let wallet = await manager.findOne(WalletEntity, {
        where: { id: walletId },
        lock: { mode: 'pessimistic_write' },
      });

      const isNew = !wallet;

      if (!wallet) {
        wallet = manager.create(WalletEntity, {
          id: walletId,
          balance: '0',
        });
      }

      // TODO: Use decimal.js for better precision
      const currentBalance = Number(wallet.balance);
      const newBalance = currentBalance + amount;

      wallet.balance = newBalance.toFixed(4);

      await manager.save(wallet);

      const event = manager.create(EventEntity, {
        type: isNew ? EventType.WalletCreated : EventType.FundsDeposited,
        walletId: wallet.id,
        payload: {
          walletId: wallet.id,
          amount,
          newBalance,
          requestId,
        },
      });
      await manager.save(event);

      eventToPublish = event;
      this.logger.debug(`Event to publish: ${JSON.stringify(eventToPublish)}`);

      const responseSnapshot = {
        balance: wallet.balance,
        created: isNew,
      };

      const op = manager.create(OperationEntity, {
        requestId,
        walletId,
        type: OperationType.Deposit,
        success: true,
        errorMessage: null,
        responseSnapshot,
      });
      await manager.save(op);

      return responseSnapshot;
    });
    this.logger.debug(`Event to publish in deposit after transaction: ${JSON.stringify(eventToPublish)}`);

    if (eventToPublish) {
      const msg: WalletEventMessage = {
        id: eventToPublish.id,
        type: eventToPublish.type,
        occurredAt: eventToPublish.createdAt.toISOString(),
        payload: eventToPublish.payload,
      };
      await this.rabbitMq.publishWalletEvent(msg);
    }

    return result;
  }

  async withdraw(walletId: string, amount: number, requestId: string) {
    const existingOp = await this.operationRepo.findOne({
      where: { requestId, walletId },
    });

    if (existingOp) {
      if (existingOp.success && existingOp.responseSnapshot) {
        return existingOp.responseSnapshot;
      }
      throw new BadRequestException(existingOp.errorMessage || 'Withdrawal failed');
    }
    let eventToPublish: EventEntity | undefined;

    try {
      const result = await this.dataSource.transaction(async (manager) => {
        let wallet = await manager.findOne(WalletEntity, {
          where: { id: walletId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!wallet) {
          const errorMessage = 'Wallet not found';
          const op = manager.create(OperationEntity, {
            requestId,
            walletId,
            type: OperationType.Withdraw,
            success: false,
            errorMessage,
            responseSnapshot: null,
          });
          await manager.save(op);

          throw new NotFoundException(errorMessage);
        }

        const currentBalance = Number(wallet.balance);
        const newBalance = currentBalance - amount;

        if (newBalance < 0) {
          const errorMessage = 'Insufficient balance';

          const op = manager.create(OperationEntity, {
            requestId,
            walletId,
            type: OperationType.Withdraw,
            success: false,
            errorMessage,
            responseSnapshot: null,
          });
          await manager.save(op);

          throw new BadRequestException(errorMessage);
        }

        wallet.balance = newBalance.toFixed(4);
        await manager.save(wallet);
        const event = manager.create(EventEntity, {
          type: EventType.FundsWithdrawn,
          walletId: wallet.id,
          payload: {
            walletId: wallet.id,
            amount,
            newBalance,
            requestId,
          },
        });
        await manager.save(event);

        eventToPublish = event;
        this.logger.debug(`Event to publish in withdraw: ${JSON.stringify(eventToPublish)}`);
        const responseSnapshot = {
          balance: wallet.balance,
          created: false,
        };

        const op = manager.create(OperationEntity, {
          requestId,
          walletId,
          type: OperationType.Withdraw,
          success: true,
          errorMessage: null,
          responseSnapshot,
        });
        await manager.save(op);

        return responseSnapshot;
      });

      if (eventToPublish) {
        const msg: WalletEventMessage = {
          id: eventToPublish.id,
          type: eventToPublish.type,
          occurredAt: eventToPublish.createdAt.toISOString(),
          payload: eventToPublish.payload,
        };
        await this.rabbitMq.publishWalletEvent(msg);
      }
      return result;
    } catch (err) {
      throw err;
    }
  }

  async transfer(
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    requestId: string,
  ) {
    if (fromWalletId === toWalletId) {
      throw new BadRequestException('Cannot transfer to the same wallet');
    }

    let transfer = await this.transferRepo.findOne({
      where: { requestId },
    });

    let eventToPublish: EventEntity | undefined;

    if (transfer && transfer.status === TransferStatus.Completed) {
      const from = await this.walletRepo.findOne({ where: { id: fromWalletId } });
      const to = await this.walletRepo.findOne({ where: { id: toWalletId } });

      return {
        transferId: transfer.id,
        status: transfer.status,
        fromBalance: from?.balance ?? '0.0000',
        toBalance: to?.balance ?? '0.0000',
      };
    }

    if (!transfer) {
      transfer = this.transferRepo.create({
        fromWalletId,
        toWalletId,
        amount: amount.toFixed(4),
        status: TransferStatus.Initiated,
        requestId,
        lastError: null,
      });

      transfer = await this.transferRepo.save(transfer);

      const event = this.eventRepo.create({
        type: EventType.TransferInitiated,
        transferId: transfer.id,
        walletId: fromWalletId,
        payload: {
          fromWalletId,
          toWalletId,
          amount,
          requestId,
          transferId: transfer.id,
        },
      });
      await this.eventRepo.save(event);
      eventToPublish = event;
      if (eventToPublish) {
        const msg: WalletEventMessage = {
          id: eventToPublish.id,
          type: eventToPublish.type,
          occurredAt: eventToPublish.createdAt.toISOString(),
          payload: eventToPublish.payload,
        };
        await this.rabbitMq.publishWalletEvent(msg);
      }
    }

    if (
      transfer.status === TransferStatus.Initiated ||
      transfer.status === TransferStatus.Failed
    ) {
      transfer = await this.debitTransfer(transfer, requestId);
    }

    if (transfer.status === TransferStatus.Debited) {
      try {
        transfer = await this.creditTransfer(transfer, requestId);
      } catch (err) {
        transfer = await this.compensateTransfer(transfer, err as Error);
      }
    }

    const from = await this.walletRepo.findOne({ where: { id: fromWalletId } });
    const to = await this.walletRepo.findOne({ where: { id: toWalletId } });

    return {
      transferId: transfer.id,
      status: transfer.status,
      fromBalance: from?.balance ?? '0.0000',
      toBalance: to?.balance ?? '0.0000',
    };
  }

  private async debitTransfer(
    transfer: TransferEntity,
    requestId: string,
  ): Promise<TransferEntity> {
    const opKey = `${requestId}-debit`;

    const existingOp = await this.operationRepo.findOne({
      where: { requestId: opKey, walletId: transfer.fromWalletId },
    });
    if (existingOp && existingOp.success) {
      if (transfer.status !== TransferStatus.Debited) {
        transfer.status = TransferStatus.Debited;
        transfer.lastError = null;
        transfer = await this.transferRepo.save(transfer);
      }
      return transfer;
    }

    return this.dataSource.transaction(async (manager) => {
      let eventToPublish: EventEntity | undefined;

      let fromWallet = await manager.findOne(WalletEntity, {
        where: { id: transfer.fromWalletId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!fromWallet) {
        const errorMessage = 'Sender wallet not found';
        const failedOp = manager.create(OperationEntity, {
          requestId: opKey,
          walletId: transfer.fromWalletId,
          type: OperationType.TransferDebit,
          success: false,
          errorMessage,
          responseSnapshot: null,
        });
        await manager.save(failedOp);

        transfer.status = TransferStatus.Failed;
        transfer.lastError = errorMessage;
        await manager.save(transfer);

        throw new NotFoundException(errorMessage);
      }

      const amount = Number(transfer.amount);
      const currentBalance = Number(fromWallet.balance);
      const newBalance = currentBalance - amount;

      if (newBalance < 0) {
        const errorMessage = 'Insufficient balance for transfer';

        const failedOp = manager.create(OperationEntity, {
          requestId: opKey,
          walletId: transfer.fromWalletId,
          type: OperationType.TransferDebit,
          success: false,
          errorMessage,
          responseSnapshot: null,
        });
        await manager.save(failedOp);

        transfer.status = TransferStatus.Failed;
        transfer.lastError = errorMessage;
        await manager.save(transfer);

        throw new BadRequestException(errorMessage);
      }

      fromWallet.balance = newBalance.toFixed(4);
      await manager.save(fromWallet);

      const debitEvent = manager.create(EventEntity, {
        type: EventType.TransferDebited,
        walletId: fromWallet.id,
        transferId: transfer.id,
        payload: {
          transferId: transfer.id,
          fromWalletId: transfer.fromWalletId,
          toWalletId: transfer.toWalletId,
          amount,
          newBalance,
        },
      });
      await manager.save(debitEvent);
      eventToPublish = debitEvent;

      const op = manager.create(OperationEntity, {
        requestId: opKey,
        walletId: transfer.fromWalletId,
        type: OperationType.TransferDebit,
        success: true,
        errorMessage: null,
        responseSnapshot: {
          fromBalance: fromWallet.balance,
        },
      });
      await manager.save(op);
      if (eventToPublish) {
        const msg: WalletEventMessage = {
          id: eventToPublish.id,
          type: eventToPublish.type,
          occurredAt: eventToPublish.createdAt.toISOString(),
          payload: eventToPublish.payload,
        };
        await this.rabbitMq.publishWalletEvent(msg);
      }

      transfer.status = TransferStatus.Debited;
      transfer.lastError = null;
      await manager.save(transfer);

      return transfer;
    });
  }

  private async creditTransfer(
    transfer: TransferEntity,
    requestId: string,
  ): Promise<TransferEntity> {
    const opKey = `${requestId}-credit`;

    const existingOp = await this.operationRepo.findOne({
      where: { requestId: opKey, walletId: transfer.toWalletId },
    });
    if (existingOp && existingOp.success) {
      if (transfer.status !== TransferStatus.Completed) {
        transfer.status = TransferStatus.Completed;
        transfer.lastError = null;
        transfer = await this.transferRepo.save(transfer);
      }
      return transfer;
    }

    return this.dataSource.transaction(async (manager) => {
      let eventToPublish: EventEntity | undefined;

      let toWallet = await manager.findOne(WalletEntity, {
        where: { id: transfer.toWalletId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!toWallet) {
        toWallet = manager.create(WalletEntity, {
          id: transfer.toWalletId,
          balance: '0',
        });
      }

      const amount = Number(transfer.amount);
      const currentBalance = Number(toWallet.balance);
      const newBalance = currentBalance + amount;

      toWallet.balance = newBalance.toFixed(4);
      await manager.save(toWallet);

      const creditEvent = manager.create(EventEntity, {
        type: EventType.TransferCredited,
        walletId: toWallet.id,
        transferId: transfer.id,
        payload: {
          transferId: transfer.id,
          fromWalletId: transfer.fromWalletId,
          toWalletId: transfer.toWalletId,
          amount,
          newBalance,
        },
      });
      await manager.save(creditEvent);
      eventToPublish = creditEvent;
      const op = manager.create(OperationEntity, {
        requestId: opKey,
        walletId: transfer.toWalletId,
        type: OperationType.TransferCredit,
        success: true,
        errorMessage: null,
        responseSnapshot: {
          toBalance: toWallet.balance,
        },
      });
      await manager.save(op);
      if (eventToPublish) {
        const msg: WalletEventMessage = {
          id: eventToPublish.id,
          type: eventToPublish.type,
          occurredAt: eventToPublish.createdAt.toISOString(),
          payload: eventToPublish.payload,
        };
        await this.rabbitMq.publishWalletEvent(msg);
      }
      transfer.status = TransferStatus.Completed;
      transfer.lastError = null;
      await manager.save(transfer);

      const completedEvent = manager.create(EventEntity, {
        type: EventType.TransferCompleted,
        walletId: transfer.fromWalletId,
        transferId: transfer.id,
        payload: {
          transferId: transfer.id,
          fromWalletId: transfer.fromWalletId,
          toWalletId: transfer.toWalletId,
          amount,
        },
      });
      await manager.save(completedEvent);
      eventToPublish = completedEvent;
      if (eventToPublish) {
        const msg: WalletEventMessage = {
          id: eventToPublish.id,
          type: eventToPublish.type,
          occurredAt: eventToPublish.createdAt.toISOString(),
          payload: eventToPublish.payload,
        };
        await this.rabbitMq.publishWalletEvent(msg);
      }
      return transfer;
    });
  }

  private async compensateTransfer(
    transfer: TransferEntity,
    error: Error,
  ): Promise<TransferEntity> {
    const opKey = `${transfer.requestId}-compensate`;

    const existingOp = await this.operationRepo.findOne({
      where: { requestId: opKey, walletId: transfer.fromWalletId },
    });
    if (existingOp && existingOp.success) {
      transfer.status = TransferStatus.Failed;
      transfer.lastError = existingOp.errorMessage;
      return this.transferRepo.save(transfer);
    }

    return this.dataSource.transaction(async (manager) => {
      let eventToPublish: EventEntity | undefined;

      let fromWallet = await manager.findOne(WalletEntity, {
        where: { id: transfer.fromWalletId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!fromWallet) {
        transfer.status = TransferStatus.Failed;
        transfer.lastError = error.message;
        await manager.save(transfer);
        return transfer;
      }

      const amount = Number(transfer.amount);
      const currentBalance = Number(fromWallet.balance);
      const newBalance = currentBalance + amount;

      fromWallet.balance = newBalance.toFixed(4);
      await manager.save(fromWallet);

      const event = manager.create(EventEntity, {
        type: EventType.TransferCompensated,
        walletId: fromWallet.id,
        transferId: transfer.id,
        payload: {
          transferId: transfer.id,
          fromWalletId: transfer.fromWalletId,
          toWalletId: transfer.toWalletId,
          amount,
          reason: error.message,
          newBalance,
        },
      });
      await manager.save(event);
      eventToPublish = event;
      const op = manager.create(OperationEntity, {
        requestId: opKey,
        walletId: transfer.fromWalletId,
        type: OperationType.TransferCompensation,
        success: true,
        errorMessage: error.message,
        responseSnapshot: {
          fromBalance: fromWallet.balance,
        },
      });
      await manager.save(op);

      if (eventToPublish) {
        const msg: WalletEventMessage = {
          id: eventToPublish.id,
          type: eventToPublish.type,
          occurredAt: eventToPublish.createdAt.toISOString(),
          payload: eventToPublish.payload,
        };
        await this.rabbitMq.publishWalletEvent(msg);
      }
      transfer.status = TransferStatus.Failed;
      transfer.lastError = error.message;
      await manager.save(transfer);

      return transfer;
    });
  }

  async getWallet(walletId: string) {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } });
    if (!wallet) {
      return {
        walletId,
        balance: '0.0000',
        exists: false,
      };
    }

    return {
      walletId,
      balance: wallet.balance,
      exists: true,
    };
  }

  async getWalletHistory(
    walletId: string,
    opts: { limit: number; before?: string },
  ) {
    const where: any = { walletId };

    if (opts.before) {
      where.createdAt = LessThan(new Date(opts.before));
    }

    const events = await this.eventRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: opts.limit,
    });

    return events.map((e) => ({
      id: e.id,
      walletId: e.walletId,
      transferId: e.transferId ?? null,
      type: e.type as EventType,
      occurredAt: e.createdAt.toISOString(),
      payload: e.payload,
    }));
  }

  async getWalletStats(walletId: string) {
    const stats = await this.statsRepo.findOne({ where: { walletId } });

    if (!stats) {
      return {
        walletId,
        totalDeposited: '0.0000',
        totalWithdrawn: '0.0000',
        totalTransferredOut: '0.0000',
        totalTransferredIn: '0.0000',
        lastActivityAt: null,
        suspicious: false,
        suspiciousReason: null,
      };
    }

    return stats;
  }
}
