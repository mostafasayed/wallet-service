import 'source-map-support/register';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const logsDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const logger = WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.simple(),
        ),
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'worker.log'),
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
        maxsize: 10 * 1024 * 1024,
        maxFiles: 5,
      }),
    ],
  });

  const app = await NestFactory.createApplicationContext(WorkerModule, { logger });
  console.log('Worker started');
}

bootstrap();
