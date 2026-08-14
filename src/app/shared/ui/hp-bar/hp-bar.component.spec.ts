import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { HpBarComponent } from './hp-bar.component';

describe('HpBarComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HpBarComponent] });
  });

  it('clamps the rendered percentage between zero and one hundred', () => {
    const fixture = TestBed.createComponent(HpBarComponent);
    fixture.componentRef.setInput('current', 15);
    fixture.componentRef.setInput('max', 10);
    fixture.detectChanges();

    const fill = fixture.nativeElement.querySelector('.hp-bar__fill') as HTMLElement;
    expect(fill.style.width).toBe('100%');
    expect(fill).toHaveClass('hp-bar__fill--healthy');

    fixture.componentRef.setInput('current', -4);
    fixture.detectChanges();
    expect(fill.style.width).toBe('0%');
    expect(fill).toHaveClass('hp-bar__fill--critical');
  });

  it('maps HP thresholds to healthy, low, and critical states', () => {
    const fixture = TestBed.createComponent(HpBarComponent);
    fixture.componentRef.setInput('current', 75);
    fixture.componentRef.setInput('max', 100);
    fixture.detectChanges();
    const fill = fixture.nativeElement.querySelector('.hp-bar__fill') as HTMLElement;
    expect(fill).toHaveClass('hp-bar__fill--healthy');

    fixture.componentRef.setInput('current', 50);
    fixture.detectChanges();
    expect(fill).toHaveClass('hp-bar__fill--low');

    fixture.componentRef.setInput('current', 25);
    fixture.detectChanges();
    expect(fill).toHaveClass('hp-bar__fill--critical');
  });

  it('handles an invalid maximum and respects display inputs', () => {
    const fixture = TestBed.createComponent(HpBarComponent);
    fixture.componentRef.setInput('current', 10);
    fixture.componentRef.setInput('max', 0);
    fixture.componentRef.setInput('size', 'lg');
    fixture.componentRef.setInput('showLabel', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.hp-bar')).toHaveClass('hp-bar--lg');
    expect(
      (fixture.nativeElement.querySelector('.hp-bar__fill') as HTMLElement).style.width,
    ).toBe('0%');
    expect(fixture.nativeElement.querySelector('.hp-bar__label')).toBeNull();
  });
});
