import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EventEntity,
  WalletStatsEntity,
  ProcessedEventEntity,
} from '@wallet/db-orm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import { WalletEventMessage, EventType } from '@wallet/common';

@Injectable()
export class WalletEventsHandlerService {
  private readonly logger = new Logger(WalletEventsHandlerService.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepo: Repository<EventEntity>,
    @InjectRepository(WalletStatsEntity)
    private readonly statsRepo: Repository<WalletStatsEntity>,
    @InjectRepository(ProcessedEventEntity)
    private readonly processedRepo: Repository<ProcessedEventEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async handleEvent(msg: WalletEventMessage) {
    await this.dataSource.transaction(async (manager) => {
      const processedRepo = manager.getRepository(ProcessedEventEntity);
      const statsRepo = manager.getRepository(WalletStatsEntity);
      const eventRepo = manager.getRepository(EventEntity);

      const already = await processedRepo.findOne({
        where: { eventId: msg.id },
      });
      if (already) {
        this.logger.debug(`Event ${msg.id} already processed, skipping`);
        return;
      }

      const dbEvent = await eventRepo.findOne({ where: { id: msg.id } });
      const effectivePayload = dbEvent?.payload ?? msg.payload;

      const walletId = dbEvent?.walletId ?? msg.payload.walletId;
      const type = msg.type as EventType;

      if (!walletId) {
        await processedRepo.save(
          processedRepo.create({
            eventId: msg.id,
            status: 'success',
            errorMessage: null,
          }),
        );
        return;
      }

      let stats = await statsRepo.findOne({ where: { walletId } });
      if (!stats) {
        stats = statsRepo.create({
          walletId,
          totalDeposited: '0',
          totalWithdrawn: '0',
          totalTransferredIn: '0',
          totalTransferredOut: '0',
          lastActivityAt: null,
          suspicious: false,
          suspiciousReason: null,
        });
      }

      const amount = Number(effectivePayload.amount ?? 0);
      const now = new Date(msg.occurredAt ?? new Date().toISOString());

      // --- Analytics aggregation ---
      if (type === EventType.FundsDeposited || EventType.WalletCreated) {
        stats.totalDeposited = (Number(stats.totalDeposited) + amount).toFixed(4);
      } else if (type === EventType.FundsWithdrawn) {
        stats.totalWithdrawn = (Number(stats.totalWithdrawn) + amount).toFixed(4);
      } else if (type === EventType.TransferCompleted) {
        const fromWalletId = effectivePayload.fromWalletId;
        const toWalletId = effectivePayload.toWalletId;
        if (walletId === fromWalletId) {
          stats.totalTransferredOut = (Number(stats.totalTransferredOut) + amount).toFixed(4);
        } else if (walletId === toWalletId) {
          stats.totalTransferredIn = (Number(stats.totalTransferredIn) + amount).toFixed(4);
        }
      }

      stats.lastActivityAt = now;

      // Simple fraud rule: 3 withdrawals in 60s OR amount > threshold
      if (type === EventType.FundsWithdrawn) {
        const ONE_MINUTE_AGO = new Date(now.getTime() - 60_000);

        const recentWithdrawals = await eventRepo.count({
          where: {
            walletId,
            type: EventType.FundsWithdrawn,
            createdAt: MoreThan(ONE_MINUTE_AGO),
          },
        });

        const thresholdAmount = 10_000;

        if (recentWithdrawals >= 3 || amount >= thresholdAmount) {
          stats.suspicious = true;
          stats.suspiciousReason = recentWithdrawals >= 3
            ? `More than 3 withdrawals within 60 seconds (count=${recentWithdrawals})`
            : `Single large withdrawal >= ${thresholdAmount}`;

          // TODO: Notification
          // TODO: Send email to the user
          this.logger.warn(
            `Suspicious activity on wallet ${walletId}: ${stats.suspiciousReason}`,
          );
        }
      }

      await statsRepo.save(stats);

      await processedRepo.save(
        processedRepo.create({
          eventId: msg.id,
          status: 'success',
          errorMessage: null,
        }),
      );
    });
  }

  async markFailed(eventId: string, error: Error) {
    await this.processedRepo.save(
      this.processedRepo.create({
        eventId,
        status: 'failed',
        errorMessage: error.message.slice(0, 255),
      }),
    );
  }
}
