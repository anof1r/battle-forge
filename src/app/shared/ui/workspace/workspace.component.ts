import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  computed,
  contentChildren,
  inject,
  input,
  model,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Directive({ selector: 'ng-template[bfWorkspaceTool]', standalone: true })
export class WorkspaceToolDirective {
  readonly id = input.required<string>({ alias: 'bfWorkspaceTool' });
  readonly title = input.required<string>();
  readonly hint = input('');
  readonly icon = input('✦');
  readonly badge = input<string | number | null>(null);
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

let nextWorkspaceId = 0;

@Component({
  selector: 'bf-workspace',
  standalone: true,
  imports: [NgTemplateOutlet, TranslocoPipe],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceComponent {
  readonly label = input.required<string>();
  readonly activeTool = model<string | null>(null);
  readonly tools = contentChildren(WorkspaceToolDirective);
  readonly active = computed(() => this.tools().find((tool) => tool.id() === this.activeTool()));
  readonly panelId = 'bf-workspace-' + nextWorkspaceId++;
  private opener: HTMLElement | null = null;

  selectTool(id: string, event: Event): void {
    this.opener = event.currentTarget as HTMLElement;
    this.activeTool.set(id);
  }

  close(): void {
    this.activeTool.set(null);
    this.opener?.focus({ preventScroll: true });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
  }
}
