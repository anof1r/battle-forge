import { Routes } from '@angular/router';
import { DmControlComponent } from './features/dm-control/dm-control.component';
import { DisplayComponent } from './features/display/display.component';

export const routes: Routes = [
  {
    path: 'dm',
    component: DmControlComponent,
  },
  {
    path: 'display',
    component: DisplayComponent,
  },
  {
    path: '',
    redirectTo: '/dm',
    pathMatch: 'full',
  },
];
