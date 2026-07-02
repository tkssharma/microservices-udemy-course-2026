import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { GracefulShutdownService } from './graceful-shutdown.service';

@Module({
  controllers: [HealthController],
  providers: [GracefulShutdownService],
  exports: [GracefulShutdownService],
})
export class HealthModule {}
