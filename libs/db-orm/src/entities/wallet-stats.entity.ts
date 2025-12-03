import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  @Entity({ name: 'wallet_stats' })
  export class WalletStatsEntity {
    @PrimaryColumn({ type: 'varchar', length: 128 })
    walletId: string;
  
    @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
    totalDeposited: string;
  
    @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
    totalWithdrawn: string;
  
    @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
    totalTransferredOut: string;
  
    @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
    totalTransferredIn: string;
  
    @Column({ type: 'timestamp', nullable: true })
    lastActivityAt: Date | null;
  
    @Column({ type: 'boolean', default: false })
    suspicious: boolean;
  
    @Column({ type: 'varchar', length: 255, nullable: true })
    suspiciousReason: string | null;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  }
  