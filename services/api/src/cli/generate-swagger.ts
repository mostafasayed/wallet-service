import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';

async function generateSwagger() {
    try {
        console.log('Initializing NestJS application...');
        process.env.DISABLE_MQ = 'true';
        const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
        console.log('Application initialized.');

        const config = new DocumentBuilder()
            .setTitle('Wallet Service API')
            .setDescription('API for managing wallets, deposits, withdrawals, and transfers')
            .setVersion('1.0')
            .build();

        const document = SwaggerModule.createDocument(app, config);

        fs.writeFileSync('./swagger.json', JSON.stringify(document, null, 2));
        console.log('Swagger JSON generated successfully to ./swagger.json');

        await app.close();
    } catch (error) {
        console.error('Error generating Swagger:', error);
        process.exit(1);
    }
}

generateSwagger();
