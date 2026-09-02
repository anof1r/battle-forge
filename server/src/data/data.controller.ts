import { Body, Controller, Delete, Get, Patch, Put, Query } from '@nestjs/common';
import { DataGateway } from './data.gateway';
import { SetDataDto, UpdateDataDto } from './data.dto';
import { DataStoreService } from './data-store.service';

@Controller('api/data')
export class DataController {
  constructor(
    private readonly store: DataStoreService,
    private readonly gateway: DataGateway,
  ) {}

  @Get()
  get(@Query('path') path: string): Promise<unknown | null> {
    return this.store.get(path);
  }

  @Put()
  async set(@Body() request: SetDataDto): Promise<{ success: true }> {
    await this.store.set(request.path, request.data);
    await this.gateway.publishRelated(request.path);
    return { success: true };
  }

  @Patch()
  async update(@Body() request: UpdateDataDto): Promise<{ success: true }> {
    await this.store.update(request.path, request.data);
    await this.gateway.publishRelated(request.path);
    return { success: true };
  }

  @Delete()
  async remove(@Query('path') path: string): Promise<{ success: true }> {
    await this.store.remove(path);
    await this.gateway.publishRelated(path);
    return { success: true };
  }
}
