import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  WalletEntity,
  EventEntity,
  OperationEntity,
  TransferEntity,
  WalletStatsEntity,
} from '@wallet/db-orm/entities';

import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WalletEntity, EventEntity, OperationEntity, TransferEntity, WalletStatsEntity]),
  ],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}
