// services/worker/src/worker.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  WalletEntity,
  EventEntity,
  OperationEntity,
  TransferEntity,
  ProcessedEventEntity,
  WalletStatsEntity,
} from '@wallet/db-orm/entities';

import { WalletEventsConsumer } from './consumers/wallet-events.consumer';
import { WalletEventsHandlerService } from './handlers/wallet-events-handler.service';
import { DLQConsumer } from './consumers/dlq.consumer';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        username: process.env.DB_USER || 'wallet',
        password: process.env.DB_PASS || 'wallet',
        database: process.env.DB_NAME || 'wallet',
        entities: [WalletEntity, EventEntity, OperationEntity, TransferEntity, ProcessedEventEntity, WalletStatsEntity],
        synchronize: true,
      }),
    }),
    TypeOrmModule.forFeature([EventEntity, ProcessedEventEntity, WalletStatsEntity]),
  ],
  providers: [WalletEventsConsumer, WalletEventsHandlerService, DLQConsumer],
})
export class WorkerModule {}
