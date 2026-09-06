import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { WorkspaceComponent, WorkspaceToolDirective } from './workspace.component';

@Component({
  standalone: true,
  imports: [WorkspaceComponent, WorkspaceToolDirective],
  template: `<bf-workspace label="Tools" [(activeTool)]="selected">
    <ng-template bfWorkspaceTool="edit" title="Editor" hint="Edit a draft"
      ><input aria-label="Draft" [value]="draft()" (input)="onInput($event)"
    /></ng-template>
    <ng-template bfWorkspaceTool="list" title="Library" [badge]="count()"
      ><p class="library">Saved entries</p></ng-template
    >
    <p class="overview">Choose a tool</p>
  </bf-workspace>`,
})
class HostComponent {
  readonly selected = signal<string | null>(null);
  readonly draft = signal('');
  readonly count = signal(2);
  onInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }
}

describe('WorkspaceComponent', () => {
  it('shows one tool at a time and preserves a draft across navigation', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const cards = root.querySelectorAll<HTMLButtonElement>('.workspace-tool');
    expect(root.querySelector('.overview')).toBeVisible();
    expect(root.querySelector('input')).not.toBeVisible();
    cards[0].click();
    fixture.detectChanges();
    const input = root.querySelector('input')!;
    input.value = 'Keep my draft';
    input.dispatchEvent(new Event('input'));
    cards[1].click();
    fixture.detectChanges();
    expect(input).not.toBeVisible();
    expect(root.querySelector('.library')).toBeVisible();
    expect(cards[1]).toHaveAttribute('aria-expanded', 'true');
    cards[0].click();
    fixture.detectChanges();
    expect(input).toBeVisible();
    expect(input.value).toBe('Keep my draft');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelector('.overview')).toBeVisible();
    expect(cards[0]).toHaveFocus();
  });

  it('follows external selection and updates card counts', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    fixture.componentInstance.selected.set('list');
    fixture.componentInstance.count.set(3);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.library')).toBeVisible();
    expect(fixture.nativeElement.querySelector('[data-tool="list"]')).toHaveTextContent('3');
    fixture.nativeElement.querySelector('.workspace-panel__close').click();
    expect(fixture.componentInstance.selected()).toBeNull();
  });
});
