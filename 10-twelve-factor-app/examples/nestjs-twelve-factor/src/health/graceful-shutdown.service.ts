import {
  Injectable,
  OnModuleDestroy,
  OnApplicationShutdown,
  Logger,
} from '@nestjs/common';

@Injectable()
export class GracefulShutdownService
  implements OnModuleDestroy, OnApplicationShutdown
{
  private readonly logger = new Logger(GracefulShutdownService.name);
  private isShuttingDown = false;

  isHealthy(): boolean {
    return !this.isShuttingDown;
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    this.logger.log('Module destroying, marking service as unhealthy...');
  }

  async onApplicationShutdown(signal: string) {
    this.logger.log(`Received shutdown signal: ${signal}`);

    // Wait for in-flight requests to complete
    this.logger.log('Waiting for in-flight requests to complete...');
    await this.sleep(5000);

    this.logger.log('Graceful shutdown complete');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
