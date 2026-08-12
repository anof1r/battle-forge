import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DEFAULT_ENEMY_ICON, ENEMY_TYPE_ICON } from '../../../core/constants/enemy-icon.constants';

/** Maps an enemy `type` string to a representative emoji glyph. */
@Component({
  selector: 'bf-enemy-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span aria-hidden="true">{{ icon() }}</span>`,
  styles: `
    :host {
      display: inline-flex;
      line-height: 1;
      filter: sepia(20%) drop-shadow(0 4px 6px rgba(0, 0, 0, 0.6));
    }
  `,
})
export class EnemyIconComponent {
  readonly type = input.required<string>();

  protected readonly icon = computed(() => {
    const key = this.type() as keyof typeof ENEMY_TYPE_ICON;
    return ENEMY_TYPE_ICON[key] ?? DEFAULT_ENEMY_ICON;
  });
}
