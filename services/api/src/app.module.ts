import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  WalletEntity,
  EventEntity,
  OperationEntity,
  TransferEntity,
  WalletStatsEntity,
  ApiAuditEntity
} from '@wallet/db-orm/entities';

import { WalletModule } from './wallet/wallet.module';
import { RabbitMqModule } from './messaging/rabbitmq.module';
import { ApiAuditInterceptor } from './audit/api-audit.interceptor';
import { ApiAuditService } from './audit/api-audit.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
  
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        username: process.env.DB_USER || 'wallet',
        password: process.env.DB_PASS || 'wallet',
        database: process.env.DB_NAME || 'wallet',
        entities: [WalletEntity, EventEntity, OperationEntity, TransferEntity, WalletStatsEntity, ApiAuditEntity],
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([ApiAuditEntity]),
    WalletModule,
    RabbitMqModule,
  ],
  providers: [
    ApiAuditService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiAuditInterceptor
    }
  ]
})
export class AppModule {}
