import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CombatantLifeStateComponent } from './combatant-life-state.component';

describe('CombatantLifeStateComponent', () => {
  it('renders a downed player and death save progress', () => {
    TestBed.configureTestingModule({ imports: [CombatantLifeStateComponent] });
    const fixture = TestBed.createComponent(CombatantLifeStateComponent);
    fixture.componentRef.setInput('status', 'downed');
    fixture.componentRef.setInput('deathSaves', { successes: 2, failures: 1 });
    fixture.detectChanges();

    expect(fixture.nativeElement).toHaveTextContent('Без сознания');
    expect(fixture.nativeElement).toHaveTextContent('✓ 2/3');
    expect(fixture.nativeElement).toHaveTextContent('✕ 1/3');
    expect(fixture.nativeElement.querySelector('.life-state')).toHaveClass('life-state--downed');
  });
});
