import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase.service';
import { map, Observable } from 'rxjs';
import {
  CharacterResource,
  ParsedCharacter,
  ResourceRecovery,
  SpellSlotPool,
} from '../models/character.model';
import { FIREBASE_ROOT, playerPath } from '../constants/firebase-paths.constants';
import { SpellData } from '../models';
import { normalizeCharacter, normalizeCharacterResources, normalizeSpellSlots } from '../utils';

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private readonly firebase = inject(FirebaseService);

  async characterExists(name: string): Promise<boolean> {
    const data = await this.firebase.get(playerPath(name));
    return data !== null;
  }

  async saveCharacter(character: ParsedCharacter): Promise<void> {
    const normalized = normalizeCharacter(character);
    await this.firebase.set(playerPath(character.name), {
      ...normalized,
      lastUpdated: Date.now(),
    });
  }

  async loadCharacter(name: string): Promise<ParsedCharacter | null> {
    const data = await this.firebase.get<ParsedCharacter>(playerPath(name));
    return data ? normalizeCharacter(data) : null;
  }

  subscribeToCharacter(name: string): Observable<ParsedCharacter | null> {
    return this.firebase
      .subscribe<ParsedCharacter>(playerPath(name))
      .pipe(map((character) => (character ? normalizeCharacter(character) : null)));
  }

  async getAllPlayers(): Promise<ParsedCharacter[]> {
    const snapshot = await this.firebase.get<Record<string, ParsedCharacter>>(
      FIREBASE_ROOT.PLAYERS,
    );
    if (!snapshot) return [];
    return Object.values(snapshot).map(normalizeCharacter);
  }

  async updatePlayerHp(name: string, newHp: number): Promise<void> {
    await this.firebase.set(`${playerPath(name)}/currentHp`, Math.max(0, newHp));
  }

  async updatePlayerSpells(playerName: string, spellData: SpellData): Promise<void> {
    const player = await this.loadCharacter(playerName);
    if (!player) return;

    const spells = [...(player.spells || [])];
    const existingIndex = spells.findIndex((s) => s.name === spellData.name);

    if (existingIndex !== -1) {
      spells[existingIndex] = { ...spells[existingIndex], ...spellData };
    } else {
      spells.push(spellData);
    }

    await this.saveCharacter({ ...player, spells });
  }

  async updatePlayerHealth(name: string, currentHp: number, temporaryHp: number): Promise<void> {
    await this.firebase.update(playerPath(name), {
      currentHp: Math.max(0, Math.floor(currentHp)),
      temporaryHp: Math.max(0, Math.floor(temporaryHp)),
      lastUpdated: Date.now(),
    });
  }

  async usePlayerSpell(playerName: string, spellId: string, slotLevel?: number): Promise<boolean> {
    const player = await this.loadCharacter(playerName);
    if (!player) return false;

    const spell = player.spells?.find((candidate) => candidate.id === spellId);
    if (!spell || !spell.isPrepared) return false;
    if (spell.isCantrip) return true;

    const slots = normalizeSpellSlots(player.spellSlots);
    if (slots.length > 0) {
      const requestedLevel = Math.max(spell.level, Math.floor(slotLevel ?? spell.level));
      const slot = slots.find((candidate) => candidate.level === requestedLevel);
      if (!slot || slot.current <= 0) return false;
      const spellSlots = slots.map((candidate) =>
        candidate.level === requestedLevel
          ? { ...candidate, current: candidate.current - 1 }
          : candidate,
      );
      await this.saveCharacter({ ...player, spellSlots });
      return true;
    }

    // Legacy characters keep their old per-spell counters until the DM configures shared slots.
    const maxUses = Math.max(1, spell.maxUses ?? 1);
    const usesRemaining = spell.usesRemaining ?? maxUses;
    if (usesRemaining <= 0) return false;

    const spells = (player.spells || []).map((candidate) =>
      candidate.id === spellId
        ? { ...candidate, maxUses, usesRemaining: usesRemaining - 1 }
        : candidate,
    );
    await this.saveCharacter({ ...player, spells });
    return true;
  }

  async restorePlayerSpells(playerName: string): Promise<void> {
    const player = await this.loadCharacter(playerName);
    if (!player) return;

    const spellSlots = normalizeSpellSlots(player.spellSlots).map((slot) => ({
      ...slot,
      current: slot.max,
    }));
    const spells = (player.spells || []).map((spell) => {
      if (spell.isCantrip) return spell;
      const maxUses = Math.max(1, spell.maxUses ?? 1);
      return { ...spell, maxUses, usesRemaining: maxUses };
    });
    await this.saveCharacter({ ...player, spells, spellSlots });
  }

  async setSpellSlotPool(playerName: string, pool: SpellSlotPool): Promise<void> {
    const player = await this.loadCharacter(playerName);
    if (!player) return;
    const level = Math.max(1, Math.min(9, Math.floor(pool.level)));
    const max = Math.max(0, Math.floor(pool.max));
    const normalized: SpellSlotPool = {
      level,
      max,
      current: Math.max(0, Math.min(max, Math.floor(pool.current))),
      ...(pool.recovery === 'short-rest' ? { recovery: 'short-rest' } : {}),
    };
    const slots = normalizeSpellSlots(player.spellSlots).filter((slot) => slot.level !== level);
    await this.saveCharacter({ ...player, spellSlots: [...slots, normalized] });
  }

  async upsertResource(playerName: string, resource: CharacterResource): Promise<void> {
    const player = await this.loadCharacter(playerName);
    if (!player) return;
    const resources = normalizeCharacterResources(player.resources);
    const isUnlimited = resource.isUnlimited === true;
    const max = isUnlimited ? 0 : Math.max(0, Math.floor(resource.max));
    const description = resource.description?.trim() ?? '';
    const normalized: CharacterResource = {
      id: resource.id || `resource_${crypto.randomUUID()}`,
      name: resource.name.trim(),
      ...(description ? { description } : {}),
      ...(isUnlimited ? { isUnlimited: true } : {}),
      max,
      current: isUnlimited ? 0 : Math.max(0, Math.min(max, Math.floor(resource.current))),
      recovery: isUnlimited ? 'manual' : resource.recovery,
    };
    if (!normalized.name) return;
    const index = resources.findIndex((candidate) => candidate.id === normalized.id);
    const next = index < 0
      ? [...resources, normalized]
      : resources.map((candidate) => (candidate.id === normalized.id ? normalized : candidate));
    await this.saveCharacter({ ...player, resources: next });
  }

  async removeResource(playerName: string, resourceId: string): Promise<void> {
    const player = await this.loadCharacter(playerName);
    if (!player) return;
    const resources = normalizeCharacterResources(player.resources).filter(
      (resource) => resource.id !== resourceId,
    );
    await this.saveCharacter({ ...player, resources });
  }

  async useResource(playerName: string, resourceId: string, amount = 1): Promise<boolean> {
    const player = await this.loadCharacter(playerName);
    if (!player) return false;
    const resources = normalizeCharacterResources(player.resources);
    const resource = resources.find((candidate) => candidate.id === resourceId);
    const spent = Math.max(1, Math.floor(amount));
    if (!resource) return false;
    if (resource.isUnlimited) return true;
    if (resource.current < spent) return false;
    await this.saveCharacter({
      ...player,
      resources: resources.map((candidate) =>
        candidate.id === resourceId
          ? { ...candidate, current: candidate.current - spent }
          : candidate,
      ),
    });
    return true;
  }

  async restoreResources(playerName: string, rest: Exclude<ResourceRecovery, 'manual'>): Promise<void> {
    const player = await this.loadCharacter(playerName);
    if (!player) return;
    const resources = normalizeCharacterResources(player.resources).map((resource) =>
      resource.recovery === rest || (rest === 'long-rest' && resource.recovery === 'short-rest')
        ? { ...resource, current: resource.max }
        : resource,
    );
    await this.saveCharacter({ ...player, resources });
  }

  async completeShortRest(playerName: string): Promise<void> {
    const player = await this.loadCharacter(playerName);
    if (!player) return;
    await this.saveCharacter({
      ...player,
      spellSlots: normalizeSpellSlots(player.spellSlots).map((slot) =>
        slot.recovery === 'short-rest' ? { ...slot, current: slot.max } : slot,
      ),
      resources: normalizeCharacterResources(player.resources).map((resource) =>
        resource.recovery === 'short-rest'
          ? { ...resource, current: resource.max }
          : resource,
      ),
    });
  }

  async completeLongRest(playerName: string, maxHp: number): Promise<void> {
    const player = await this.loadCharacter(playerName);
    if (!player) return;

    const spells = (player.spells || []).map((spell) => {
      if (spell.isCantrip) return spell;
      const maxUses = Math.max(1, spell.maxUses ?? 1);
      return { ...spell, maxUses, usesRemaining: maxUses };
    });
    await this.saveCharacter({
      ...player,
      currentHp: Math.max(0, maxHp),
      temporaryHp: 0,
      spells,
      spellSlots: normalizeSpellSlots(player.spellSlots).map((slot) => ({
        ...slot,
        current: slot.max,
      })),
      resources: normalizeCharacterResources(player.resources).map((resource) =>
        resource.recovery === 'manual' ? resource : { ...resource, current: resource.max },
      ),
    });
  }

  async removePlayerSpell(playerName: string, spellId: string): Promise<void> {
    const player = await this.loadCharacter(playerName);
    if (!player) return;

    const spells = (player.spells || []).filter((s) => s.id !== spellId);
    await this.saveCharacter({ ...player, spells });
  }
}
