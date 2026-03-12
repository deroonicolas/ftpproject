import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FileService {
  // On utilise l'URL de base configurée dans ton environment.ts
  private apiUrl = `${environment.apiUrl}/files`;

  constructor(private http: HttpClient) {}

  // "folder" sera soit 'camera', soit 'shared'
  getFiles(folder: string) {
    return this.http.get<any[]>(`${this.apiUrl}/${folder}`);
  }

  deleteFile(folder: string, id: string) {
    return this.http.delete(`${this.apiUrl}/${folder}/${id}`);
  }
}
