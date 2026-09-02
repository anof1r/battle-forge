import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DataController } from './data.controller';
import { DataGateway } from './data.gateway';
import { DataPathResolver } from './data-path';
import { DataStoreService } from './data-store.service';
import { MongoRecordRepository } from './mongo-record.repository';
import { RecordRepository } from './record.repository';
import {
  REALTIME_RECORD_MODEL,
  RealtimeRecordSchema,
} from './realtime-record.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: REALTIME_RECORD_MODEL, schema: RealtimeRecordSchema },
    ]),
  ],
  controllers: [DataController],
  providers: [
    DataPathResolver,
    DataStoreService,
    DataGateway,
    { provide: RecordRepository, useClass: MongoRecordRepository },
  ],
  exports: [DataStoreService],
})
export class DataModule {}
