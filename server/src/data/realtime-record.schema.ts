import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

export const REALTIME_RECORD_MODEL = 'RealtimeRecord';

@Schema({ collection: 'realtime-records', versionKey: false })
export class RealtimeRecord {
  @Prop({ required: true, type: String })
  _id!: string;

  @Prop({ required: true, type: MongooseSchema.Types.Mixed })
  data!: unknown;

  @Prop({ required: true, type: Number })
  updatedAt!: number;
}

export const RealtimeRecordSchema = SchemaFactory.createForClass(RealtimeRecord);
