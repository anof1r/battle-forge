import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ImageCroppedEvent, ImageCropperComponent } from 'ngx-image-cropper';
import {
  AVATAR_OWNER_TYPE,
  AvatarOwnerType,
  AvatarReference,
  ParsedCharacter,
} from '../../../core/models';
import { AvatarService } from '../../../core/services/avatar.service';
import { BattleService } from '../../../core/services/battle.service';
import { CharacterService } from '../../../core/services/character.service';
import { LoggerService } from '../../../core/services/logger.service';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { SceneLibraryService } from '../scene-library/scene-library.service';

interface PortraitOwner {
  id: string;
  name: string;
  subtitle: string;
  avatar?: AvatarReference;
}

const MAX_SOURCE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_SOURCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Component({
  selector: 'app-dm-portraits',
  standalone: true,
  imports: [AvatarComponent, ImageCropperComponent, TranslocoPipe],
  templateUrl: './dm-portraits.component.html',
  styleUrl: './dm-portraits.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmPortraitsComponent implements OnDestroy {
  private readonly avatars = inject(AvatarService);
  private readonly battle = inject(BattleService);
  private readonly characters = inject(CharacterService);
  private readonly library = inject(SceneLibraryService);
  private readonly logger = inject(LoggerService);
  private readonly i18n = inject(TranslocoService);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly ownerType = signal<AvatarOwnerType>(AVATAR_OWNER_TYPE.PLAYER);
  readonly players = signal<ParsedCharacter[]>([]);
  readonly selectedOwnerId = signal('');
  readonly imageChangedEvent = signal<Event | null>(null);
  readonly croppedBlob = signal<Blob | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly imageReady = signal(false);
  readonly loadingPlayers = signal(true);
  readonly saving = signal(false);
  readonly removing = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly creatureCount = computed(() => this.library.creatures().length);
  readonly owners = computed<PortraitOwner[]>(() =>
    this.ownerType() === AVATAR_OWNER_TYPE.PLAYER
      ? this.players().map((player) => ({
          id: player.name,
          name: player.name,
          subtitle: `${player.race} · ${player.class}`,
          avatar: player.avatar,
        }))
      : this.library.creatures().map((creature) => ({
          id: creature.id,
          name: creature.name,
          subtitle: creature.subtype || this.i18n.translate('portraits.creatureWithoutType'),
          avatar: creature.avatar,
        })),
  );

  readonly selectedOwner = computed(() =>
    this.owners().find((owner) => owner.id === this.selectedOwnerId()) ?? null,
  );

  constructor() {
    void this.loadPlayers();
  }

  ngOnDestroy(): void {
    this.revokePreviewUrl();
  }

  selectOwnerType(ownerType: AvatarOwnerType): void {
    if (this.ownerType() === ownerType) return;
    this.ownerType.set(ownerType);
    this.selectedOwnerId.set('');
    this.resetCrop();
    this.clearMessages();
  }

  selectOwner(ownerId: string): void {
    this.selectedOwnerId.set(ownerId);
    this.resetCrop();
    this.clearMessages();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.clearMessages();
    this.resetCrop(false);
    if (!file) return;
    if (!ACCEPTED_SOURCE_TYPES.has(file.type)) {
      this.error.set(this.i18n.translate('portraits.error.unsupportedType'));
      return;
    }
    if (file.size > MAX_SOURCE_SIZE) {
      this.error.set(this.i18n.translate('portraits.error.tooLarge'));
      return;
    }
    this.imageChangedEvent.set(event);
  }

  onImageCropped(event: ImageCroppedEvent): void {
    if (!event.blob || !event.objectUrl) return;
    const previousUrl = this.previewUrl();
    if (previousUrl && previousUrl !== event.objectUrl) URL.revokeObjectURL(previousUrl);
    this.croppedBlob.set(event.blob);
    this.previewUrl.set(event.objectUrl);
  }

  onImageLoaded(): void {
    this.imageReady.set(true);
  }

  onLoadFailed(): void {
    this.resetCrop();
    this.error.set(this.i18n.translate('portraits.error.load'));
  }

  async savePortrait(): Promise<void> {
    const owner = this.selectedOwner();
    const blob = this.croppedBlob();
    if (!owner || !blob || this.saving()) return;

    this.saving.set(true);
    this.clearMessages();
    try {
      const avatar = await this.avatars.upload(this.ownerType(), owner.id, blob);
      await this.battle.syncAvatar(this.ownerType(), owner.id, avatar);
      this.updatePlayerAvatar(owner.id, avatar);
      this.feedback.set(this.i18n.translate('portraits.feedback.saved', { name: owner.name }));
      this.resetCrop();
    } catch (error) {
      this.logger.error('DmPortraitsComponent.savePortrait', error);
      this.error.set(this.i18n.translate('portraits.error.save'));
    } finally {
      this.saving.set(false);
    }
  }

  async removePortrait(): Promise<void> {
    const owner = this.selectedOwner();
    if (!owner?.avatar || this.removing()) return;
    if (!confirm(this.i18n.translate('portraits.confirmRemove', { name: owner.name }))) return;

    this.removing.set(true);
    this.clearMessages();
    try {
      await this.avatars.remove(this.ownerType(), owner.id);
      await this.battle.syncAvatar(this.ownerType(), owner.id, null);
      this.updatePlayerAvatar(owner.id, null);
      this.feedback.set(this.i18n.translate('portraits.feedback.removed', { name: owner.name }));
      this.resetCrop();
    } catch (error) {
      this.logger.error('DmPortraitsComponent.removePortrait', error);
      this.error.set(this.i18n.translate('portraits.error.remove'));
    } finally {
      this.removing.set(false);
    }
  }

  private async loadPlayers(): Promise<void> {
    try {
      this.players.set(await this.characters.getAllPlayers());
    } catch (error) {
      this.logger.error('DmPortraitsComponent.loadPlayers', error);
      this.error.set(this.i18n.translate('portraits.error.loadPlayers'));
    } finally {
      this.loadingPlayers.set(false);
    }
  }

  private updatePlayerAvatar(ownerId: string, avatar: AvatarReference | null): void {
    if (this.ownerType() !== AVATAR_OWNER_TYPE.PLAYER) return;
    this.players.update((players) =>
      players.map((player) => {
        if (player.name !== ownerId) return player;
        if (avatar) return { ...player, avatar };
        const updated = { ...player };
        delete updated.avatar;
        return updated;
      }),
    );
  }

  private resetCrop(clearInput = true): void {
    this.revokePreviewUrl();
    this.imageChangedEvent.set(null);
    this.croppedBlob.set(null);
    this.imageReady.set(false);
    if (clearInput) {
      const input = this.fileInput()?.nativeElement;
      if (input) input.value = '';
    }
  }

  private revokePreviewUrl(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
  }

  private clearMessages(): void {
    this.feedback.set(null);
    this.error.set(null);
  }
}