import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Pino logger (Factor XI: Logs)
  app.useLogger(app.get(Logger));

  // Enable graceful shutdown (Factor IX: Disposability)
  app.enableShutdownHooks();

  // Get port from config (Factor III: Config)
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  // Port binding (Factor VII: Port Binding)
  await app.listen(port, '0.0.0.0');

  console.log(`Application running on port ${port}`);
}

bootstrap();
