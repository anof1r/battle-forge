import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { RealtimeRecord, REALTIME_RECORD_MODEL } from './realtime-record.schema';
import {
  RecordPatchOperation,
  RecordRepository,
  StoredRecord,
} from './record.repository';

@Injectable()
export class MongoRecordRepository extends RecordRepository {
  constructor(
    @InjectModel(REALTIME_RECORD_MODEL)
    private readonly records: Model<RealtimeRecord>,
  ) {
    super();
  }

  async find(path: string): Promise<StoredRecord | null> {
    const record = await this.records.findById(path).lean<RealtimeRecord>().exec();
    return record ? this.toStoredRecord(record) : null;
  }

  async findCollection(collectionPath: string): Promise<StoredRecord[]> {
    const escapedPath = collectionPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const records = await this.records
      .find({ _id: { $regex: `^${escapedPath}/[^/]+$` } })
      .lean<RealtimeRecord[]>()
      .exec();
    return records.map((record) => this.toStoredRecord(record));
  }

  async replace(path: string, data: unknown): Promise<void> {
    await this.records
      .replaceOne(
        { _id: path },
        { _id: path, data, updatedAt: Date.now() },
        { upsert: true },
      )
      .exec();
  }

  async patch(path: string, operations: RecordPatchOperation[]): Promise<void> {
    const setValues: Record<string, unknown> = { updatedAt: Date.now() };
    const unsetValues: Record<string, 1> = {};
    let hasSetOperation = false;

    for (const operation of operations) {
      const mongoPath = `data.${operation.nestedSegments.join('.')}`;
      if (operation.type === 'unset') {
        unsetValues[mongoPath] = 1;
      } else {
        setValues[mongoPath] = operation.value;
        hasSetOperation = true;
      }
    }

    const update: UpdateQuery<RealtimeRecord> = { $set: setValues };
    if (Object.keys(unsetValues).length > 0) update.$unset = unsetValues;
    await this.records
      .updateOne({ _id: path }, update, { upsert: hasSetOperation, strict: false })
      .exec();
  }

  async remove(path: string): Promise<void> {
    await this.records.deleteOne({ _id: path }).exec();
  }

  async removeCollection(collectionPath: string): Promise<void> {
    const escapedPath = collectionPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await this.records.deleteMany({ _id: { $regex: `^${escapedPath}/[^/]+$` } }).exec();
  }

  private toStoredRecord(record: RealtimeRecord): StoredRecord {
    return { path: record._id, data: record.data, updatedAt: record.updatedAt };
  }
}
