import { LanguageService } from './core/i18n/language.service';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // Apply the saved language on every route, including login and display.
  private readonly language = inject(LanguageService);
}
