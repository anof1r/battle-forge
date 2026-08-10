import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Reusable HP bar used by both the DM control panel and the player display.
 * Purely presentational — derives its visual state from `current`/`max`.
 */
@Component({
  selector: 'bf-hp-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hp-bar.component.html',
  styleUrl: './hp-bar.component.scss',
})
export class HpBarComponent {
  readonly current = input.required<number>();
  readonly max = input.required<number>();
  readonly size = input<'sm' | 'lg'>('sm');
  readonly showLabel = input(true);

  protected readonly percent = computed(() => {
    const max = this.max();
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((this.current() / max) * 100)));
  });

  protected readonly state = computed<'healthy' | 'low' | 'critical'>(() => {
    const pct = this.percent();
    if (pct <= 25) return 'critical';
    if (pct <= 50) return 'low';
    return 'healthy';
  });
}
