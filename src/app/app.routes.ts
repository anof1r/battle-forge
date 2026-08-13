import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/display', pathMatch: 'full' },

  {
    path: 'dm',
    loadComponent: () =>
      import('./features/dm-control/dm-control.component').then((m) => m.DmControlComponent),
  },

  {
    path: 'display',
    loadComponent: () =>
      import('./features/display/display.component').then((m) => m.DisplayComponent),
  },

  {
    path: 'player',
    loadComponent: () =>
      import('./features/player/player.component').then((m) => m.PlayerComponent),
  },

  { path: '**', redirectTo: '/display' },
];
