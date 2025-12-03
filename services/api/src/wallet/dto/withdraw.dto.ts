import { IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WithdrawDto {
  @ApiProperty({ example: 50, description: 'Amount to withdraw' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 'req-456', description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  requestId?: string;
}
