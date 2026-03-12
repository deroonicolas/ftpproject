import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('auth_token');

  if (token) {
    // Si le token existe, on laisse passer
    return true;
  } else {
    // Sinon, redirection forcée vers le login
    router.navigate(['/login']);
    return false;
  }
};
