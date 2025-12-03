import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'api_audit' })
export class ApiAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  method: string;

  @Column({ type: 'varchar', length: 255 })
  path: string;

  @Column({ type: 'int', nullable: true })
  statusCode: number | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  walletId: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  requestId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  clientIp: string | null;

  @Column({ type: 'jsonb', nullable: true })
  body: any;

  @Column({ type: 'jsonb', nullable: true })
  headers: any;

  @CreateDateColumn()
  createdAt: Date;
}
