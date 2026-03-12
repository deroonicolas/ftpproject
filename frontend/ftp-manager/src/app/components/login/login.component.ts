import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  constructor(private authService: AuthService) {}

  valider(password: string) {
    if (!password) return;
    // Maintenant l'appel match avec la nouvelle signature du service
    this.authService.login(password);
  }
}
