import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/display', pathMatch: 'full' },
  {
    path: 'dm',
    loadComponent: () =>
      import('./features/dm-control/dm-control.component').then((m) => m.DmControlComponent),
  },
  {
    path: 'player',
    loadComponent: () =>
      import('./features/player/player.component').then((m) => m.PlayerComponent),
  },
];
