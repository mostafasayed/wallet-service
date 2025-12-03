import { IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DepositDto {
  @ApiProperty({ example: 100, description: 'Amount to deposit' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 'req-123', description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  requestId?: string;
}
