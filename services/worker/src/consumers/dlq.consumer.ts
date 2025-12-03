import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, connect, ConsumeMessage } from 'amqplib';

@Injectable()
export class DLQConsumer implements OnModuleInit {
  private readonly logger = new Logger(DLQConsumer.name);
  private channel: Channel;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');
    const dlq = 'wallet.events.dlq';

    const conn = await connect(url);
    this.channel = await conn.createChannel();

    await this.channel.assertQueue(dlq, { durable: true });

    this.channel.consume(dlq, (msg) => this.handleDLQMessage(msg), {
      noAck: true, // do not requeue DLQ messages
    });

    this.logger.log(`Listening to DLQ: ${dlq}`);
  }

  private handleDLQMessage(msg: ConsumeMessage | null) {
    if (!msg) return;
    const event = msg.content.toString();

    this.logger.error(`‼️ DLQ MESSAGE RECEIVED:`, event);

    // TODO: Add failed event to DB and notify
  }
}
