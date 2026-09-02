export interface RecordPatchOperation {
  nestedSegments: string[];
  type: 'set' | 'unset';
  value?: unknown;
}

export interface StoredRecord {
  data: unknown;
  path: string;
  updatedAt: number;
}

export abstract class RecordRepository {
  abstract find(path: string): Promise<StoredRecord | null>;
  abstract findCollection(collectionPath: string): Promise<StoredRecord[]>;
  abstract replace(path: string, data: unknown): Promise<void>;
  abstract patch(path: string, operations: RecordPatchOperation[]): Promise<void>;
  abstract remove(path: string): Promise<void>;
  abstract removeCollection(collectionPath: string): Promise<void>;
}
