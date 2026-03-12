import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private url = `${environment.apiUrl}/login`;

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  login(password: string) {
    console.log(this.url, password)
    return this.http
      .post<{ token: string; role: string }>(this.url, { password })
      .subscribe({
        next: (res) => {
          localStorage.setItem('auth_token', res.token);
          localStorage.setItem('user_role', res.role);
          this.router.navigate(['/videos']);
        },
        error: () => alert('Mot de passe incorrect'),
      });
  }
}
