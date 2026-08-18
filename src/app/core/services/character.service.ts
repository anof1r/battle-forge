import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase.service';
import { Observable } from 'rxjs';
import { ParsedCharacter } from '../models/character.model';
import { FIREBASE_ROOT, playerPath } from '../constants/firebase-paths.constants';
import { SpellData } from '../models';

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private readonly firebase = inject(FirebaseService);

  async characterExists(name: string): Promise<boolean> {
    const data = await this.firebase.get(playerPath(name));
    return data !== null;
  }

  async saveCharacter(character: ParsedCharacter): Promise<void> {
    await this.firebase.set(playerPath(character.name), {
      ...character,
      lastUpdated: Date.now(),
    });
  }

  async loadCharacter(name: string): Promise<ParsedCharacter | null> {
    const data = await this.firebase.get<ParsedCharacter>(playerPath(name));
    return data ?? null;
  }

  subscribeToCharacter(name: string): Observable<ParsedCharacter | null> {
    return this.firebase.subscribe<ParsedCharacter>(playerPath(name));
  }

  async getAllPlayers(): Promise<ParsedCharacter[]> {
    const snapshot = await this.firebase.get<Record<string, ParsedCharacter>>(
      FIREBASE_ROOT.PLAYERS,
    );
    if (!snapshot) return [];
    return Object.values(snapshot);
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

  async usePlayerSpell(playerName: string, spellId: string): Promise<boolean> {
    const player = await this.loadCharacter(playerName);
    if (!player) return false;

    const spell = player.spells?.find((candidate) => candidate.id === spellId);
    if (!spell || !spell.isPrepared) return false;
    if (spell.isCantrip) return true;

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

    const spells = (player.spells || []).map((spell) => {
      if (spell.isCantrip) return spell;
      const maxUses = Math.max(1, spell.maxUses ?? 1);
      return { ...spell, maxUses, usesRemaining: maxUses };
    });
    await this.saveCharacter({ ...player, spells });
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
      spells,
    });
  }

  async removePlayerSpell(playerName: string, spellId: string): Promise<void> {
    const player = await this.loadCharacter(playerName);
    if (!player) return;

    const spells = (player.spells || []).filter((s) => s.id !== spellId);
    await this.saveCharacter({ ...player, spells });
  }
}
