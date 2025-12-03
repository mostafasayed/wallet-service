import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    Index,
  } from 'typeorm';
  import { WalletEntity } from './wallet.entity';
  import { TransferEntity } from './transfer.entity';
  import { EventType } from '@wallet/common/enums/event-type.enum';
  
  @Entity({ name: 'events' })
  export class EventEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ type: 'enum', enum: EventType })
    type: EventType;
  
    @Index()
    @Column({ name: 'wallet_id', type: 'varchar', length: 128, nullable: true })
    walletId: string | null;
  
    @ManyToOne(() => WalletEntity, (wallet) => wallet.events, {
      onDelete: 'SET NULL',
    })
    wallet: WalletEntity;
  
    @Index()
    @Column({ name: 'transfer_id', type: 'uuid', nullable: true })
    transferId: string | null;
  
    @ManyToOne(() => TransferEntity, (transfer) => transfer.events, {
      onDelete: 'SET NULL',
    })
    transfer: TransferEntity;
  
    @Column({ type: 'jsonb' })
    payload: Record<string, any>;
  
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
  }
  