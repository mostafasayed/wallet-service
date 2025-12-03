import {
    Entity,
    PrimaryColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
  } from 'typeorm';
  import { EventEntity } from './event.entity';
  import { TransferEntity } from './transfer.entity';
  import { OperationEntity } from './operation.entity';
  
  @Entity({ name: 'wallets' })
  export class WalletEntity {
    @PrimaryColumn({ type: 'varchar', length: 128 })
    id: string;
  
    @Column('numeric', { precision: 20, scale: 4, default: 0 })
    balance: string;
  
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
  
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
  
    @OneToMany(() => EventEntity, (event) => event.wallet, { cascade: false })
    events: EventEntity[];
  
    @OneToMany(() => OperationEntity, (op) => op.wallet, { cascade: false })
    operations: OperationEntity[];
  
    @OneToMany(() => TransferEntity, (transfer) => transfer.fromWallet, {
      cascade: false,
    })
    outgoingTransfers: TransferEntity[];
  
    @OneToMany(() => TransferEntity, (transfer) => transfer.toWallet, {
      cascade: false,
    })
    incomingTransfers: TransferEntity[];
  }
  