import { Injectable } from '@angular/core';
import {
  CharacterResource,
  CharacterResourceSpendResult,
  ResourceRecovery,
} from '../models/character-resource.model';
import { normalizeCharacterResources } from '../utils/character-normalizer.util';

/** Pure domain rules for character resource pools. Persistence stays in CharacterService. */
@Injectable({ providedIn: 'root' })
export class CharacterResourceService {
  upsert(
    current: readonly CharacterResource[] | null | undefined,
    resource: CharacterResource,
  ): CharacterResource[] {
    const resources = normalizeCharacterResources(current);
    const normalized = normalizeCharacterResources([
      {
        ...resource,
        id: resource.id || `resource_${crypto.randomUUID()}`,
      },
    ])[0];
    if (!normalized?.name) return resources;

    return resources.some((candidate) => candidate.id === normalized.id)
      ? resources.map((candidate) => (candidate.id === normalized.id ? normalized : candidate))
      : [...resources, normalized];
  }

  remove(
    current: readonly CharacterResource[] | null | undefined,
    resourceId: string,
  ): CharacterResource[] {
    return normalizeCharacterResources(current).filter((resource) => resource.id !== resourceId);
  }

  spend(
    current: readonly CharacterResource[] | null | undefined,
    resourceId: string,
    amount = 1,
  ): CharacterResourceSpendResult {
    const resources = normalizeCharacterResources(current);
    const resource = resources.find((candidate) => candidate.id === resourceId);
    const spentAmount = Math.max(1, Math.floor(amount));
    if (!resource || (!resource.isUnlimited && resource.current < spentAmount)) {
      return { resources, spent: false, changed: false };
    }
    if (resource.isUnlimited) return { resources, spent: true, changed: false };

    return {
      spent: true,
      changed: true,
      resources: resources.map((candidate) =>
        candidate.id === resourceId
          ? { ...candidate, current: candidate.current - spentAmount }
          : candidate,
      ),
    };
  }

  restore(
    current: readonly CharacterResource[] | null | undefined,
    rest: Exclude<ResourceRecovery, 'manual'>,
  ): CharacterResource[] {
    return normalizeCharacterResources(current).map((resource) => {
      if (rest === 'short-rest' && (resource.shortRestRestore ?? 0) > 0) {
        return {
          ...resource,
          current: Math.min(resource.max, resource.current + resource.shortRestRestore!),
        };
      }
      return resource.recovery === rest || (rest === 'long-rest' && resource.recovery === 'short-rest')
        ? { ...resource, current: resource.max }
        : resource;
    });
  }
}
