import { Module } from '@nestjs/common';
import { Open5eController } from './open5e.controller';
import { Open5eProxyService } from './open5e-proxy.service';

@Module({
  controllers: [Open5eController],
  providers: [Open5eProxyService],
})
export class Open5eModule {}
