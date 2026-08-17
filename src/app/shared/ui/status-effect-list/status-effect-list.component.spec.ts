import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ActiveStatusEffect } from '../../../core/models/combatant.model';
import { StatusEffectListComponent } from './status-effect-list.component';

describe('StatusEffectListComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [StatusEffectListComponent] });
  });

  it('renders effect labels, icons, and visual modifiers', () => {
    const fixture = TestBed.createComponent(StatusEffectListComponent);
    const effects: ActiveStatusEffect[] = [
      { id: 'poison-1', type: 'poisoned', appliedAt: 1 },
      { id: 'blessing-1', type: 'blessed', appliedAt: 2 },
    ];
    fixture.componentRef.setInput('effects', effects);
    fixture.componentRef.setInput('label', 'Текущие эффекты');
    fixture.detectChanges();

    const chips = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('.effect-chip'),
    );

    expect(fixture.nativeElement).toHaveTextContent('Текущие эффекты');
    expect(fixture.nativeElement).toHaveTextContent('Отравление');
    expect(fixture.nativeElement).toHaveTextContent('Благословение');
    expect(chips[0]).toHaveClass('effect-chip--poisoned');
    expect(chips[1]).toHaveClass('effect-chip--blessed');
  });

  it('renders an empty list without placeholder content', () => {
    const fixture = TestBed.createComponent(StatusEffectListComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.effect-chip')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.status-effects__label')).toBeNull();
  });
});
