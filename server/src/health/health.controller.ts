import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('api/health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  status(): { database: 'connected' | 'disconnected'; status: 'ok' | 'degraded' } {
    const connected = this.connection.readyState === 1;
    return {
      database: connected ? 'connected' : 'disconnected',
      status: connected ? 'ok' : 'degraded',
    };
  }
}
