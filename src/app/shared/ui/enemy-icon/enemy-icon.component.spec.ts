import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_ENEMY_ICON, ENEMY_TYPE_ICON } from '../../../core/constants/enemy-icon.constants';
import { EnemyIconComponent } from './enemy-icon.component';

describe('EnemyIconComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EnemyIconComponent] });
  });

  it('renders the configured icon for a known enemy type', () => {
    const fixture = TestBed.createComponent(EnemyIconComponent);
    fixture.componentRef.setInput('type', 'dragon');
    fixture.detectChanges();

    expect(fixture.nativeElement).toHaveTextContent(ENEMY_TYPE_ICON.dragon);
  });

  it('uses the fallback icon for an unknown enemy type', () => {
    const fixture = TestBed.createComponent(EnemyIconComponent);
    fixture.componentRef.setInput('type', 'aberration');
    fixture.detectChanges();

    expect(fixture.nativeElement).toHaveTextContent(DEFAULT_ENEMY_ICON);
  });
});
