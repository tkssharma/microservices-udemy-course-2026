import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './health/health.module';
import { OrdersModule } from './orders/orders.module';
import configuration from './config/configuration';
import { validate } from './config/env.validation';

@Module({
  imports: [
    // Factor III: Config - Environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),

    // Factor XI: Logs - Structured logging to stdout
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL') || 'info',
          transport:
            config.get('NODE_ENV') === 'development'
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
          redact: ['req.headers.authorization'],
        },
      }),
    }),

    // Factor IV: Backing Services - Database as attached resource
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') === 'development',
      }),
    }),

    // Feature modules
    HealthModule,
    OrdersModule,
  ],
})
export class AppModule {}
