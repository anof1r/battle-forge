import { Controller, Get, Param, Query } from '@nestjs/common';
import { Open5eProxyService } from './open5e-proxy.service';

@Controller('api/open5e')
export class Open5eController {
  constructor(private readonly proxy: Open5eProxyService) {}

  @Get(':resource')
  search(
    @Param('resource') resource: string,
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.proxy.search(resource, query);
  }
}
