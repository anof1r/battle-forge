import { BadRequestException, Injectable } from '@nestjs/common';

export const DATA_COLLECTION_PATHS = [
  'rooms',
  'players',
  'dm-library/creatures',
  'dm-library/scenes',
  'dm-library/items',
  'dm-library/spells',
  'dm-library/enemy-actions',
  'dm-library/stories/main/sections',
] as const;

export interface ResolvedDataPath {
  collectionPath: string;
  entityKey: string | null;
  entityPath: string | null;
  nestedSegments: string[];
  normalizedPath: string;
}

const FORBIDDEN_SEGMENT_CHARACTERS = /[.#$\[\]\u0000-\u001f\u007f]/;

@Injectable()
export class DataPathResolver {
  resolve(path: string): ResolvedDataPath {
    const normalizedPath = this.normalize(path);
    const collectionPath = DATA_COLLECTION_PATHS
      .toSorted((left, right) => right.length - left.length)
      .find(
        (candidate) =>
          normalizedPath === candidate || normalizedPath.startsWith(`${candidate}/`),
      );

    if (!collectionPath) {
      throw new BadRequestException(`Unsupported data path: ${normalizedPath}`);
    }

    const remainder = normalizedPath.slice(collectionPath.length).replace(/^\//, '');
    if (!remainder) {
      return {
        collectionPath,
        entityKey: null,
        entityPath: null,
        nestedSegments: [],
        normalizedPath,
      };
    }

    const [entityKey, ...nestedSegments] = remainder.split('/');
    return {
      collectionPath,
      entityKey,
      entityPath: `${collectionPath}/${entityKey}`,
      nestedSegments,
      normalizedPath,
    };
  }

  child(basePath: string, relativePath: string): ResolvedDataPath {
    const normalizedRelativePath = this.normalize(relativePath);
    return this.resolve(`${this.normalize(basePath)}/${normalizedRelativePath}`);
  }

  isRelated(leftPath: string, rightPath: string): boolean {
    const left = this.normalize(leftPath);
    const right = this.normalize(rightPath);
    return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
  }

  private normalize(path: string): string {
    if (typeof path !== 'string') {
      throw new BadRequestException('Data path must be a string.');
    }

    const normalized = path.trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
    if (!normalized) {
      throw new BadRequestException('Data path is required.');
    }

    const segments = normalized.split('/');
    if (segments.some((segment) => !segment || FORBIDDEN_SEGMENT_CHARACTERS.test(segment))) {
      throw new BadRequestException(`Invalid data path: ${normalized}`);
    }
    return normalized;
  }
}
