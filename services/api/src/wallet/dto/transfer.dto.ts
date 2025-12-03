import { IsNumber, IsPositive, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferDto {
  @ApiProperty({ example: 'wallet-2', description: 'Recipient wallet ID' })
  @IsString()
  toWalletId: string;

  @ApiProperty({ example: 25, description: 'Amount to transfer' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 'req-789', description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  requestId?: string;
}
