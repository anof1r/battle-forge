import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../../core/i18n/language.service';

@Component({
  selector: 'bf-language-switcher',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './language-switcher.component.html',
  styleUrl: './language-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSwitcherComponent {
  protected readonly language = inject(LanguageService);

  setLanguage(event: Event): void {
    this.language.setLanguage((event.target as HTMLSelectElement).value);
  }
}
