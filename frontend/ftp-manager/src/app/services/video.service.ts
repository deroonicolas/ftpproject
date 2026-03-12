import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Video {
  id: string;
  name: string;
  size: number;
  createdAt: string;
  type: string;
}

@Injectable({
  providedIn: 'root'
})
export class VideoService {

  constructor(private http: HttpClient) { }

  // 1. Liste les fichiers (Camera ou Shared)
  list(folder: string): Observable<Video[]> {
    return this.http.get<Video[]>(`${environment.apiUrl}/files/${folder}`);
  }

  // 2. Upload un fichier
  upload(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file); // 'file' doit correspondre au nom dans server.js
    return this.http.post(`${environment.apiUrl}/upload`, formData);
  }

  // 3. Téléchargement d'un fichier
  download(folder: string, filename: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/download/${folder}/${filename}`, {
      responseType: 'blob'
    });
  }

  // 4. Suppression d'un fichier
  delete(folder: string, filename: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/files/${folder}/${filename}`);
  }
}