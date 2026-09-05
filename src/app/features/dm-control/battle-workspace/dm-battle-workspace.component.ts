import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../../core/constants/combatant.constants';
import { BattleService } from '../../../core/services/battle.service';
import { StatusEffectListComponent } from '../../../shared/ui/status-effect-list/status-effect-list.component';
import { CombatantLifeStateComponent } from '../../../shared/ui/combatant-life-state/combatant-life-state.component';
import { DmBattleControlsComponent } from '../battle-controls/dm-battle-controls.component';
import { DmBattleHistoryComponent } from '../battle-history/dm-battle-history.component';
import { DmCombatantRosterComponent } from '../combatant-roster/dm-combatant-roster.component';
import { DmHpControlComponent } from '../hp-control/dm-hp-control.component';
import { DmInitiativeComponent } from '../initiative/dm-initiative.component';
import { DmStatusEffectsComponent } from '../status-effects/dm-status-effects.component';

type BattleTool = 'controls' | 'participants' | 'effects' | 'history';

@Component({
  selector: 'app-dm-battle-workspace',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    StatusEffectListComponent,
    CombatantLifeStateComponent,
    DmBattleControlsComponent,
    DmBattleHistoryComponent,
    DmCombatantRosterComponent,
    DmHpControlComponent,
    DmInitiativeComponent,
    DmStatusEffectsComponent,
  ],
  templateUrl: './dm-battle-workspace.component.html',
  styleUrl: './dm-battle-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { '(window:resize)': 'updateDialogMode()' },
})
export class DmBattleWorkspaceComponent {
  private readonly battle = inject(BattleService);
  private readonly drawer = viewChild<ElementRef<HTMLDialogElement>>('drawer');
  private readonly drawerTitle = viewChild<ElementRef<HTMLElement>>('drawerTitle');
  private opener: HTMLElement | null = null;
  private modal = false;

  readonly active = input(true);
  readonly sceneFinished = output<void>();
  readonly activeTool = signal<BattleTool | null>(null);
  readonly initiativeVisible = signal(false);
  readonly initiativeRolls = signal<Record<string, number>>({});
  readonly COMBATANT_STATUS = COMBATANT_STATUS;
  readonly battleStatus = this.battle.battleStatus;
  readonly currentRound = this.battle.currentRound;
  readonly currentCombatant = this.battle.currentCombatant;
  readonly combatants = this.battle.sortedCombatants;
  readonly playerCount = computed(
    () => this.combatants().filter((combatant) => combatant.type === COMBATANT_TYPE.PLAYER).length,
  );
  readonly enemyCount = computed(
    () => this.combatants().filter((combatant) => combatant.type === COMBATANT_TYPE.ENEMY).length,
  );
  readonly effectCount = computed(() =>
    this.combatants().reduce((total, combatant) => total + (combatant.activeEffects?.length ?? 0), 0),
  );
  readonly historyCount = computed(() => this.battle.history().length);
  readonly tools = [
    { id: 'controls', icon: '⚔', title: 'dmBattle.controls', hint: 'dmBattle.controlsHint' },
    { id: 'participants', icon: '♟', title: 'dmBattle.participants', hint: 'dmBattle.participantsHint' },
    { id: 'effects', icon: '✦', title: 'dmBattle.effects', hint: 'dmBattle.effectsHint' },
    { id: 'history', icon: '↶', title: 'dmBattle.history', hint: 'dmBattle.historyHint' },
  ] as const;
  readonly toolTitle = computed(
    () => this.tools.find((tool) => tool.id === this.activeTool())?.title ?? 'dmBattle.controls',
  );

  constructor() {
    effect(() => {
      if (!this.active()) this.closeTool(false);
    });
  }

  openTool(tool: BattleTool, event?: Event): void {
    const dialog = this.drawer()?.nativeElement;
    if (!dialog) return;
    if (event?.currentTarget instanceof HTMLElement) {
      this.opener = event.currentTarget;
    } else if (!dialog.open && document.activeElement instanceof HTMLElement) {
      this.opener = document.activeElement;
    }
    const scrollContainer = dialog.closest('app-dm-control');
    const scrollTop = scrollContainer?.scrollTop ?? 0;
    if (this.activeTool() !== tool) dialog.scrollTop = 0;
    this.activeTool.set(tool);
    if (!dialog.open) {
      this.modal = window.innerWidth <= 760;
      if (this.modal) dialog.showModal();
      else dialog.show();
    }
    this.drawerTitle()?.nativeElement.focus({ preventScroll: true });
    if (scrollContainer) scrollContainer.scrollTop = scrollTop;
  }

  closeTool(restoreFocus = true): void {
    const dialog = this.drawer()?.nativeElement;
    if (dialog?.open) dialog.close();
    this.activeTool.set(null);
    if (restoreFocus && this.opener?.isConnected) this.opener.focus({ preventScroll: true });
    this.opener = null;
  }

  onDrawerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.closeTool();
  }

  onDrawerCancel(event: Event): void {
    event.preventDefault();
    this.closeTool();
  }

  updateDialogMode(): void {
    const dialog = this.drawer()?.nativeElement;
    if (!dialog?.open || this.modal === (window.innerWidth <= 760)) return;
    const focused = document.activeElement;
    dialog.close();
    this.modal = window.innerWidth <= 760;
    if (this.modal) dialog.showModal();
    else dialog.show();
    if (focused instanceof HTMLElement && dialog.contains(focused)) {
      focused.focus({ preventScroll: true });
    }
  }

  openInitiative(rolls: Record<string, number>): void {
    this.initiativeRolls.set(rolls);
    this.initiativeVisible.set(true);
    this.openTool('controls');
  }

  finishScene(): void {
    this.initiativeVisible.set(false);
    this.closeTool(false);
    this.sceneFinished.emit();
  }
}
