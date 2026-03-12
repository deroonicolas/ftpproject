import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { VideoListComponent } from './pages/video-list/video-list.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'videos', component: VideoListComponent, canActivate: [authGuard] },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
];
