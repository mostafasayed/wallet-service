import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiAuditEntity } from '@wallet/db-orm/entities';

@Injectable()
export class ApiAuditService {
  constructor(
    @InjectRepository(ApiAuditEntity)
    private readonly auditRepo: Repository<ApiAuditEntity>,
  ) {}

  async record(data: {
    method: string;
    path: string;
    statusCode: number | null;
    walletId?: string | null;
    requestId?: string | null;
    clientIp?: string | null;
    body?: any;
    headers?: any;
  }) {
    const audit = this.auditRepo.create({
      method: data.method,
      path: data.path,
      statusCode: data.statusCode ?? null,
      walletId: data.walletId ?? null,
      requestId: data.requestId ?? null,
      clientIp: data.clientIp ?? null,
      body: data.body ?? null,
      headers: data.headers ?? null,
    });

    await this.auditRepo.save(audit);
  }
}
