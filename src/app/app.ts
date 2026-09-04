import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageSwitcherComponent } from './shared/ui/language-switcher/language-switcher.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LanguageSwitcherComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
