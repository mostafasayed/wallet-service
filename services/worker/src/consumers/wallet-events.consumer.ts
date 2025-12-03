import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChannelModel, connect, ConsumeMessage } from 'amqplib';
import { WalletEventMessage } from '@wallet/common';
import { WalletEventsHandlerService } from '../handlers/wallet-events-handler.service';

@Injectable()
export class WalletEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(WalletEventsConsumer.name);
  private connection: ChannelModel;
  private channel: Channel;

  constructor(
    private readonly configService: ConfigService,
    private readonly walletEventsHandler: WalletEventsHandlerService
  ) {}

  async onModuleInit() {
    const url = this.configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');
    const exchange = this.configService.get<string>('RABBITMQ_EXCHANGE', 'wallet.events');
    const dlx = `${exchange}.dlx`;

    this.connection = await connect(url);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(exchange, 'fanout', { durable: true });
    await this.channel.assertExchange(dlx, 'fanout', { durable: true });

    const dlqName = 'wallet.events.dlq';
    await this.channel.assertQueue(dlqName, {
      durable: true,
    });
    await this.channel.bindQueue(dlqName, dlx, '');

    const { queue } = await this.channel.assertQueue('wallet.events.worker', {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': dlx,
        'x-message-ttl': 30000, 
        'x-max-length': 10000
      }});

    await this.channel.bindQueue(queue, exchange, '');
    this.channel.consume(queue, (msg) => this.handleMessage(msg), { noAck: false });

    this.logger.log(`Consuming wallet events from queue "${queue}"`);
    this.logger.log(`DLQ configured: ${dlqName}`);
  }

  private async handleMessage(msg: ConsumeMessage | null) {
    if (!msg) return;

    try {
      const content = msg.content.toString();
      const event: WalletEventMessage = JSON.parse(content);

      this.logger.log(
        `Received event ${event.id} of type ${event.type} for wallet ${event.payload.walletId}`,
      );

      await this.walletEventsHandler.handleEvent(event);

      this.channel.ack(msg);
    } catch (err) {
      this.logger.error('Error handling wallet event', err as any);
      this.channel.nack(msg, false, false);
    }
  }
}
