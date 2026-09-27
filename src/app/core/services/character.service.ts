import { Injectable, inject } from '@angular/core';
import { RealtimeDataService } from './realtime-data.service';
import { map, Observable } from 'rxjs';
import { ParsedCharacter } from '../models/character.model';
import { CharacterResource, ResourceRecovery } from '../models/character-resource.model';
import { SpellSlotPool } from '../models/spell-slot.model';
import { DATA_ROOT, playerPath } from '../constants/data-paths.constants';
import { SpellData } from '../models';
import { normalizeCharacter } from '../utils';
import { CharacterResourceService } from './character-resource.service';
import { CharacterSpellService } from './character-spell.service';

const INVALID_CHARACTER_NAME = /[\/.#$\[\]\u0000-\u001f\u007f]/;

export class CharacterNameConflictError extends Error {}
export class InvalidCharacterNameError extends Error {}

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private readonly realtimeData = inject(RealtimeDataService);
  private readonly resourceRules = inject(CharacterResourceService);
  private readonly spellRules = inject(CharacterSpellService);

  async characterExists(name: string): Promise<boolean> {
    const data = await this.realtimeData.get(playerPath(name));
    return data !== null;
  }

  async saveCharacter(character: ParsedCharacter): Promise<void> {
    const normalized = normalizeCharacter(character);
    await this.realtimeData.set(playerPath(character.name), {
      ...normalized,
      lastUpdated: Date.now(),
    });
  }

  async updateCharacter(
    originalName: string,
    character: ParsedCharacter,
  ): Promise<ParsedCharacter> {
    const sourceName = originalName.trim();
    const name = character.name.trim();
    if (!sourceName || !name || INVALID_CHARACTER_NAME.test(name)) {
      throw new InvalidCharacterNameError('Character name is empty or contains forbidden symbols.');
    }

    const normalized = normalizeCharacter({ ...character, name });
    const persisted = { ...normalized, lastUpdated: Date.now() };
    if (name === sourceName) {
      await this.realtimeData.set(playerPath(sourceName), persisted);
      return normalized;
    }

    if (await this.characterExists(name)) {
      throw new CharacterNameConflictError(`Character "${name}" already exists.`);
    }
    await this.realtimeData.update(DATA_ROOT.PLAYERS, {
      [name]: persisted,
      [sourceName]: null,
    });
    return normalized;
  }

  async loadCharacter(name: string): Promise<ParsedCharacter | null> {
    const data = await this.realtimeData.get<ParsedCharacter>(playerPath(name));
    return data ? normalizeCharacter(data) : null;
  }

  subscribeToCharacter(name: string): Observable<ParsedCharacter | null> {
    return this.realtimeData
      .subscribe<ParsedCharacter>(playerPath(name))
      .pipe(map((character) => (character ? normalizeCharacter(character) : null)));
  }

  async getAllPlayers(): Promise<ParsedCharacter[]> {
    const snapshot = await this.realtimeData.get<Record<string, ParsedCharacter>>(
      DATA_ROOT.PLAYERS,
    );
    if (!snapshot) return [];
    return Object.values(snapshot).map(normalizeCharacter);
  }

  async updatePlayerHp(name: string, newHp: number): Promise<void> {
    await this.realtimeData.set(`${playerPath(name)}/currentHp`, Math.max(0, newHp));
  }

  async updatePlayerSpells(playerName: string, spellData: SpellData): Promise<void> {
    await this.updateLoadedCharacter(playerName, (player) => ({
      spells: this.spellRules.upsert(player.spells, spellData),
    }));
  }

  async updatePlayerHealth(name: string, currentHp: number, temporaryHp: number): Promise<void> {
    await this.realtimeData.update(playerPath(name), {
      currentHp: Math.max(0, Math.floor(currentHp)),
      temporaryHp: Math.max(0, Math.floor(temporaryHp)),
      lastUpdated: Date.now(),
    });
  }

  async usePlayerSpell(playerName: string, spellId: string, slotLevel?: number): Promise<boolean> {
    const player = await this.loadCharacter(playerName);
    if (!player) return false;
    const result = this.spellRules.use(player.spells, player.spellSlots, spellId, slotLevel);
    if (result.shouldPersist) {
      await this.saveCharacter({
        ...player,
        spells: result.spells,
        spellSlots: result.spellSlots,
      });
    }
    return result.used;
  }

  async restorePlayerSpells(playerName: string): Promise<void> {
    await this.updateLoadedCharacter(playerName, (player) => ({
      ...this.spellRules.restore(player.spells, player.spellSlots),
    }));
  }

  async setSpellSlotPool(playerName: string, pool: SpellSlotPool): Promise<void> {
    await this.updateLoadedCharacter(playerName, (player) => ({
      spellSlots: this.spellRules.upsertSlot(player.spellSlots, pool),
    }));
  }

  async upsertResource(playerName: string, resource: CharacterResource): Promise<void> {
    await this.updateLoadedCharacter(playerName, (player) => ({
      resources: this.resourceRules.upsert(player.resources, resource),
    }));
  }

  async removeResource(playerName: string, resourceId: string): Promise<void> {
    await this.updateLoadedCharacter(playerName, (player) => ({
      resources: this.resourceRules.remove(player.resources, resourceId),
    }));
  }

  async useResource(playerName: string, resourceId: string, amount = 1): Promise<boolean> {
    const player = await this.loadCharacter(playerName);
    if (!player) return false;
    const result = this.resourceRules.spend(player.resources, resourceId, amount);
    if (result.changed) {
      await this.saveCharacter({ ...player, resources: result.resources });
    }
    return result.spent;
  }

  async restoreResources(
    playerName: string,
    rest: Exclude<ResourceRecovery, 'manual'>,
  ): Promise<void> {
    await this.updateLoadedCharacter(playerName, (player) => ({
      resources: this.resourceRules.restore(player.resources, rest),
    }));
  }

  async completeShortRest(playerName: string): Promise<void> {
    await this.updateLoadedCharacter(playerName, (player) => ({
      spellSlots: this.spellRules.restoreShortRestSlots(player.spellSlots),
      resources: this.resourceRules.restore(player.resources, 'short-rest'),
    }));
  }

  async completeLongRest(playerName: string, maxHp: number): Promise<void> {
    const player = await this.loadCharacter(playerName);
    if (!player) return;

    const restoredSpells = this.spellRules.restore(player.spells, player.spellSlots);
    await this.saveCharacter({
      ...player,
      currentHp: Math.max(0, maxHp),
      temporaryHp: 0,
      ...restoredSpells,
      resources: this.resourceRules.restore(player.resources, 'long-rest'),
    });
  }

  async removePlayerSpell(playerName: string, spellId: string): Promise<void> {
    await this.updateLoadedCharacter(playerName, (player) => ({
      spells: this.spellRules.remove(player.spells, spellId),
    }));
  }
  /** Centralizes load/patch/save; this is not a cross-client transaction. */
  private async updateLoadedCharacter(
    name: string,
    patch: (character: ParsedCharacter) => Partial<ParsedCharacter>,
  ): Promise<void> {
    const character = await this.loadCharacter(name);
    if (!character) return;
    await this.saveCharacter({ ...character, ...patch(character) });
  }
}
