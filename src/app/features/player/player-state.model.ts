import { CharacterResource } from '../../core/models/character-resource.model';
import { InventoryItem } from '../../core/models/inventory-item.model';
import {
  ItemUseConfirmation,
  ResourceEffectConfirmation,
  ResourceUseConfirmation,
  SpellUseConfirmation,
} from './player-view.model';

export interface PlayerSessionState {
  name: string;
  lastName: string | null;
  error: string | null;
  loggedIn: boolean;
  uploadPrompt: boolean;
}
export interface PlayerSheetState {
  tool: string | null;
  tab: 'character' | 'arena' | 'settings';
  expandedAbility: string | null;
  error: string | null;
}
export interface PlayerAttackState {
  enemyId: string | null;
  damage: number;
  weaponIndex: number;
  mode: 'main' | 'additional';
}
export interface PlayerSpellState {
  pendingId: string | null;
  error: string | null;
  selectedSlots: Record<string, number>;
  confirmation: SpellUseConfirmation | null;
}
export interface PlayerResourceState {
  pendingId: string | null;
  error: string | null;
  confirmation: ResourceUseConfirmation | null;
  effectConfirmation: ResourceEffectConfirmation | null;
  updatingEffectId: string | null;
  selected: CharacterResource | null;
  amount: number;
}
export interface PlayerInventoryState {
  pending: boolean;
  error: string | null;
  confirmation: ItemUseConfirmation | null;
  mode: 'use' | 'examine';
  open: boolean;
  quantity: number;
  selected: InventoryItem | null;
}

// Factories give each session fresh collections and one complete reset per workflow.
export const createSessionState = (lastName: string | null = null): PlayerSessionState => ({
  name: '',
  lastName,
  error: null,
  loggedIn: false,
  uploadPrompt: false,
});
export const createSheetState = (): PlayerSheetState => ({
  tool: null,
  tab: 'character',
  expandedAbility: null,
  error: null,
});
export const createAttackState = (): PlayerAttackState => ({
  enemyId: null,
  damage: 0,
  weaponIndex: 0,
  mode: 'main',
});
export const createSpellState = (): PlayerSpellState => ({
  pendingId: null,
  error: null,
  selectedSlots: {},
  confirmation: null,
});
export const createResourceState = (): PlayerResourceState => ({
  pendingId: null,
  error: null,
  confirmation: null,
  effectConfirmation: null,
  updatingEffectId: null,
  selected: null,
  amount: 1,
});
export const createInventoryState = (): PlayerInventoryState => ({
  pending: false,
  error: null,
  confirmation: null,
  mode: 'use',
  open: false,
  quantity: 1,
  selected: null,
});
