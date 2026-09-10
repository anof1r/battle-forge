import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { AvatarReference } from '../../../core/models/avatar.model';
import { buildAvatarUrl } from '../../../core/services/avatar.service';

@Component({
  selector: 'bf-avatar',
  standalone: true,
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  private readonly failedSignature = signal<string | null>(null);

  readonly avatar = input<AvatarReference | null | undefined>(null);
  readonly name = input('');
  readonly fallback = input('');
  readonly size = input(64);

  readonly signature = computed(() => {
    const avatar = this.avatar();
    return avatar ? `${avatar.key}:${avatar.version}` : null;
  });
  readonly imageUrl = computed(() =>
    this.failedSignature() === this.signature() ? null : buildAvatarUrl(this.avatar()),
  );
  readonly initials = computed(() => {
    const words = this.name().trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('') || '?';
  });

  handleImageError(): void {
    this.failedSignature.set(this.signature());
  }
}