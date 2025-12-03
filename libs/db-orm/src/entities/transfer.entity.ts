import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
  } from 'typeorm';
  import { WalletEntity } from './wallet.entity';
  import { EventEntity } from './event.entity';
  import { TransferStatus } from '@wallet/common';
  
  @Entity({ name: 'transfers' })
  export class TransferEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Index()
    @Column({ name: 'from_wallet_id', type: 'varchar', length: 128 })
    fromWalletId: string;
  
    @Index()
    @Column({ name: 'to_wallet_id', type: 'varchar', length: 128 })
    toWalletId: string;
  
    @ManyToOne(() => WalletEntity, (wallet) => wallet.outgoingTransfers, {
      onDelete: 'RESTRICT',
    })
    fromWallet: WalletEntity;
  
    @ManyToOne(() => WalletEntity, (wallet) => wallet.incomingTransfers, {
      onDelete: 'RESTRICT',
    })
    toWallet: WalletEntity;
  
    @Column('numeric', { precision: 20, scale: 4 })
    amount: string;
  
    @Column({ type: 'enum', enum: TransferStatus })
    status: TransferStatus;
  
    @Column({ name: 'last_error', type: 'text', nullable: true })
    lastError: string | null;
  
    @Column({ name: 'request_id', type: 'varchar', length: 128, nullable: true })
    requestId: string | null;
  
    @OneToMany(() => EventEntity, (event) => event.transfer, { cascade: false })
    events: EventEntity[];
  
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
  
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
  }
  