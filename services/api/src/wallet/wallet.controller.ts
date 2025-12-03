import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { TransferDto } from './dto/transfer.dto';

@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) { }

  @Post(':id/deposit')
  @ApiOperation({ summary: 'Deposit funds into a wallet' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  @ApiResponse({ status: 201, description: 'Deposit successful' })
  async deposit(
    @Param('id') walletId: string,
    @Body() body: DepositDto,
  ) {
    const requestId = body.requestId ?? `${walletId}-deposit-${Date.now()}`;

    const result = await this.walletService.deposit(walletId, body.amount, requestId);

    return {
      walletId,
      balance: result.balance,
      requestId,
      created: result.created,
    };
  }

  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Withdraw funds from a wallet' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  @ApiResponse({ status: 201, description: 'Withdrawal successful' })
  @ApiResponse({ status: 400, description: 'Insufficient funds or invalid request' })
  async withdraw(
    @Param('id') walletId: string,
    @Body() body: WithdrawDto,
  ) {
    const requestId = body.requestId ?? `${walletId}-withdraw-${Date.now()}`;

    const result = await this.walletService.withdraw(walletId, body.amount, requestId);

    return {
      walletId,
      balance: result.balance,
      requestId,
      created: result.created,
    };
  }

  @Post(':id/transfer')
  @ApiOperation({ summary: 'Transfer funds between wallets' })
  @ApiParam({ name: 'id', description: 'Sender Wallet ID' })
  @ApiResponse({ status: 201, description: 'Transfer initiated/completed' })
  @ApiResponse({ status: 400, description: 'Invalid transfer or insufficient funds' })
  async transfer(
    @Param('id') fromWalletId: string,
    @Body() body: TransferDto,
  ) {
    const requestId =
      body.requestId ?? `${fromWalletId}-to-${body.toWalletId}-transfer-${Date.now()}`;

    const result = await this.walletService.transfer(
      fromWalletId,
      body.toWalletId,
      body.amount,
      requestId,
    );

    return {
      transferId: result.transferId,
      fromWalletId,
      toWalletId: body.toWalletId,
      amount: body.amount,
      status: result.status,
      requestId,
      fromBalance: result.fromBalance,
      toBalance: result.toBalance,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get wallet details' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  @ApiResponse({ status: 200, description: 'Wallet details returned' })
  async getWallet(@Param('id') walletId: string) {
    return this.walletService.getWallet(walletId);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get wallet transaction history' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit number of records (default 50)' })
  @ApiQuery({ name: 'before', required: false, description: 'Get records before this date' })
  @ApiResponse({ status: 200, description: 'History returned' })
  async getHistory(
    @Param('id') walletId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const take = limit ? Math.min(Number(limit) || 50, 200) : 50;

    return this.walletService.getWalletHistory(walletId, {
      limit: take,
      before,
    });
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get wallet statistics' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  @ApiResponse({ status: 200, description: 'Statistics returned' })
  async getStats(@Param('id') walletId: string) {
    return this.walletService.getWalletStats(walletId);
  }
}
