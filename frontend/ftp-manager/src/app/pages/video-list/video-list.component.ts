import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { VideoService, Video } from '../../services/video.service';
import { VideoPopupComponent } from '../../components/video-popup/video-popup.component';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-video-list',
  standalone: true,
  imports: [CommonModule, VideoPopupComponent],
  templateUrl: './video-list.component.html',
  styleUrls: ['./video-list.component.css'],
})
export class VideoListComponent implements OnInit {
  videos: Video[] = [];
  selectedVideoUrl?: any;
  showPopup = false;
  currentFolder: 'camera' | 'shared' = 'camera'; // Gère l'onglet actif
  userRole: string = '';
  constructor(
    private videoService: VideoService, // Assure-toi que ce service utilise /api/files/:folder
    private sanitizer: DomSanitizer,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    // CORRECTION : On utilise la clé 'user_role' définie dans ton AuthService
    this.userRole = localStorage.getItem('user_role') || 'viewer';
    this.loadVideos();
  }

  switchTab(folder: 'camera' | 'shared') {
    console.log("Changement d'onglet vers :", folder);
    this.currentFolder = folder;
    this.loadVideos(); // On recharge les données immédiatement
  }

  view(video: any) {
    const token = localStorage.getItem('auth_token');
    // On utilise la route de streaming (uniquement pour camera dans ton server.js)
    const rawUrl = `${environment.apiUrl}/video/${video.id}?token=${token}`;
    this.selectedVideoUrl = this.sanitizer.bypassSecurityTrustUrl(rawUrl);
    this.showPopup = true;
  }

  loadVideos(): void {
    // IMPORTANT : On passe l'onglet actuel (camera ou shared) au service
    this.videoService.list(this.currentFolder).subscribe({
      next: (v) => {
        this.videos = v;
        console.log('Fichiers chargés pour :', this.currentFolder);
      },
      error: (err) => console.error('Erreur de chargement', err),
    });
  }

  // Fix image_c979db : cette fonction doit exister dans le composant
  download(video: Video): void {
    this.videoService
      .download(this.currentFolder, video.id)
      .subscribe((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = video.name;
        a.click();
        window.URL.revokeObjectURL(url);
      });
  }

  // Fix image_c96a21 : on passe bien le folder actuel
  delete(video: Video): void {
    if (!confirm(`Supprimer "${video.name}" ?`)) return;
    this.videoService.delete(this.currentFolder, video.id).subscribe(() => {
      this.videos = this.videos.filter((v) => v.id !== video.id);
    });
  }

  closePopup() {
    this.showPopup = false;
    this.selectedVideoUrl = undefined;
  }

  logout() {
    localStorage.removeItem('auth_token'); // On supprime le token
    this.router.navigate(['/login']); // Retour à la case départ
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.videoService.upload(file).subscribe({
        next: () => {
          alert('Fichier ajouté avec succès !');
          this.loadVideos(); // Rafraîchit la liste
        },
        error: () => alert("Erreur lors de l'envoi"),
      });
    }
  }
}
