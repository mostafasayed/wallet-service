import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryColumn,
  } from 'typeorm';
  
  @Entity({ name: 'processed_events' })
  export class ProcessedEventEntity {
    @PrimaryColumn({ type: 'varchar', length: 64 })
    eventId: string;
  
    @Column({ type: 'varchar', length: 64 })
    status: 'success' | 'failed';
  
    @Column({ type: 'varchar', length: 255, nullable: true })
    errorMessage: string | null;
  
    @CreateDateColumn()
    processedAt: Date;
  }
  