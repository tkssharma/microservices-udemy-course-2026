import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { GracefulShutdownService } from './graceful-shutdown.service';

@Controller('health')
export class HealthController {
  constructor(private readonly shutdownService: GracefulShutdownService) {}

  @Get('live')
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  readiness() {
    if (!this.shutdownService.isHealthy()) {
      throw new HttpException(
        'Service is shutting down',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: 'ready', timestamp: new Date().toISOString() };
  }
}
