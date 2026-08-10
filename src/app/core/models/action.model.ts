export interface BattleAction {
  id: string;
  timestamp: number;
  type: 'damage' | 'heal' | 'statusChange' | 'initiative';
  targetId: string;
  value: number;
  description: string;
  reversible: boolean;
  previousValue?: number;
}
