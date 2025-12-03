import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    Index,
  } from 'typeorm';
  import { WalletEntity } from './wallet.entity';
  import { OperationType } from '@wallet/common/enums/operation-type.enum';
  
  @Entity({ name: 'operations' })
  @Index(['requestId', 'walletId'], { unique: true })
  export class OperationEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ name: 'request_id', type: 'varchar', length: 128 })
    requestId: string;
  
    @Column({ name: 'wallet_id', type: 'varchar', length: 128 })
    walletId: string;
  
    @ManyToOne(() => WalletEntity, (wallet) => wallet.operations, {
      onDelete: 'CASCADE',
    })
    wallet: WalletEntity;
  
    @Column({ type: 'enum', enum: OperationType })
    type: OperationType;
  
    @Column({ name: 'success', type: 'boolean' })
    success: boolean;
  
    @Column({ name: 'error_message', type: 'text', nullable: true })
    errorMessage: string | null;
  
    @Column({ name: 'response_snapshot', type: 'jsonb', nullable: true })
    responseSnapshot: any | null; // serialized API response to return on duplicate
  
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
  }
  