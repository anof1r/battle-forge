import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Maps an enemy `type` string to a representative emoji glyph. */
@Component({
  selector: 'bf-enemy-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (type()) {
      @case ('dragon') {
        <span aria-hidden="true">🐉</span>
      }
      @case ('goblin') {
        <span aria-hidden="true">👹</span>
      }
      @case ('orc') {
        <span aria-hidden="true">🗡️</span>
      }
      @case ('undead') {
        <span aria-hidden="true">💀</span>
      }
      @case ('beast') {
        <span aria-hidden="true">🦁</span>
      }
      @default {
        <span aria-hidden="true">👹</span>
      }
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 1;
    }
  `,
})
export class EnemyIconComponent {
  readonly type = input.required<string>();
}
