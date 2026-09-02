import { BadRequestException, Injectable } from '@nestjs/common';
import { DataPathResolver, ResolvedDataPath } from './data-path';
import { RecordPatchOperation, RecordRepository } from './record.repository';

@Injectable()
export class DataStoreService {
  constructor(
    private readonly repository: RecordRepository,
    private readonly paths: DataPathResolver,
  ) {}

  async get(path: string): Promise<unknown | null> {
    const resolved = this.paths.resolve(path);
    if (!resolved.entityPath) {
      const records = await this.repository.findCollection(resolved.collectionPath);
      return records.length > 0
        ? Object.fromEntries(
            records.map((record) => [this.paths.resolve(record.path).entityKey, record.data]),
          )
        : null;
    }

    const record = await this.repository.find(resolved.entityPath);
    if (!record) return null;
    return this.readNested(record.data, resolved.nestedSegments);
  }

  async set(path: string, data: unknown): Promise<void> {
    const resolved = this.paths.resolve(path);
    if (!resolved.entityPath) {
      await this.replaceCollection(resolved, data);
      return;
    }

    if (resolved.nestedSegments.length === 0) {
      if (data === null) await this.repository.remove(resolved.entityPath);
      else await this.repository.replace(resolved.entityPath, data);
      return;
    }

    await this.repository.patch(resolved.entityPath, [this.toPatch(resolved, data)]);
  }

  async update(path: string, updates: Record<string, unknown>): Promise<void> {
    const groups = new Map<string, RecordPatchOperation[]>();
    for (const [relativePath, value] of Object.entries(updates)) {
      const resolved = this.paths.child(path, relativePath);
      if (!resolved.entityPath) {
        throw new BadRequestException('An update must target an entity or its child.');
      }
      const operations = groups.get(resolved.entityPath) ?? [];
      operations.push(this.toPatch(resolved, value));
      groups.set(resolved.entityPath, operations);
    }

    for (const [entityPath, operations] of groups) {
      const entityOperations = operations.filter((operation) => operation.nestedSegments.length === 0);
      if (entityOperations.length > 0) {
        if (operations.length !== 1) {
          throw new BadRequestException('Conflicting parent and child update paths.');
        }
        const [operation] = entityOperations;
        if (operation.type === 'unset') await this.repository.remove(entityPath);
        else await this.repository.replace(entityPath, operation.value);
      } else {
        await this.repository.patch(entityPath, operations);
      }
    }
  }

  async remove(path: string): Promise<void> {
    const resolved = this.paths.resolve(path);
    if (!resolved.entityPath) {
      await this.repository.removeCollection(resolved.collectionPath);
    } else if (resolved.nestedSegments.length === 0) {
      await this.repository.remove(resolved.entityPath);
    } else {
      await this.repository.patch(resolved.entityPath, [this.toPatch(resolved, null)]);
    }
  }

  private async replaceCollection(resolved: ResolvedDataPath, data: unknown): Promise<void> {
    if (data === null) {
      await this.repository.removeCollection(resolved.collectionPath);
      return;
    }
    if (!this.isRecord(data)) {
      throw new BadRequestException('A collection value must be an object or null.');
    }

    await this.repository.removeCollection(resolved.collectionPath);
    for (const [entityKey, value] of Object.entries(data)) {
      const entity = this.paths.child(resolved.collectionPath, entityKey);
      await this.repository.replace(entity.entityPath!, value);
    }
  }

  private toPatch(resolved: ResolvedDataPath, value: unknown): RecordPatchOperation {
    return value === null
      ? { nestedSegments: resolved.nestedSegments, type: 'unset' }
      : { nestedSegments: resolved.nestedSegments, type: 'set', value };
  }

  private readNested(data: unknown, segments: string[]): unknown | null {
    let value = data;
    for (const segment of segments) {
      if (!this.isRecord(value) || !(segment in value)) return null;
      value = value[segment];
    }
    return value === undefined ? null : value;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
