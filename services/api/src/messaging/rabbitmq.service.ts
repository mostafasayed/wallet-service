import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChannelModel, connect } from 'amqplib';
import { WalletEventMessage } from '@wallet/common';

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection: ChannelModel;
  private channel: Channel;
  private exchangeName: string;

  constructor(private readonly configService: ConfigService) {
    this.exchangeName = this.configService.get<string>('RABBITMQ_EXCHANGE', 'wallet.events');
  }

  async onModuleInit() {
    if (process.env.DISABLE_MQ === 'true') {
      this.logger.log('RabbitMQ disabled (DISABLE_MQ=true), skipping connection');
      return;
    }

    const url = this.configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');
    this.connection = await connect(url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(this.exchangeName, 'fanout', { durable: true });

    this.logger.log(`Connected to RabbitMQ at ${url}, exchange "${this.exchangeName}"`);

  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (err) {
      this.logger.error('Error closing RabbitMQ connection', err as any);
    }
  }

  async publishWalletEvent(event: WalletEventMessage) {
    this.logger.warn('Publishing event', event);
    if (!this.channel) {
      this.logger.warn('RabbitMQ channel not ready, skipping publish');
      return;
    }

    const payload = Buffer.from(JSON.stringify(event));
    const routingKey = '';

    const ok = this.channel.publish(
      this.exchangeName,
      routingKey,
      payload,
      {
        contentType: 'application/json',
        messageId: event.id,
        type: event.type,
      },
    );

    if (!ok) {
      this.logger.warn(`Publish returned false for event ${event.id}`);
    }
  }
}
