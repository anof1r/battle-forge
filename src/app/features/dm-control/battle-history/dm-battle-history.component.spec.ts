import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BattleService } from '../../../core/services/battle.service';
import { DmBattleHistoryComponent } from './dm-battle-history.component';

describe('DmBattleHistoryComponent', () => {
  it('renders newest battle actions first', () => {
    TestBed.configureTestingModule({
      imports: [DmBattleHistoryComponent],
      providers: [
        {
          provide: BattleService,
          useValue: {
            history: signal([
              { id: 'one', description: 'First', timestamp: 1 },
              { id: 'two', description: 'Second', timestamp: 2 },
            ]),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(DmBattleHistoryComponent);
    fixture.detectChanges();
    const entries = fixture.nativeElement.querySelectorAll('.dm-history__entry');

    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent('Second');
    expect(entries[1]).toHaveTextContent('First');
  });
});
