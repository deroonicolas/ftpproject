import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-video-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-popup.component.html',
  styleUrls: ['./video-popup.component.css'],
})
export class VideoPopupComponent {
  @Input() videoUrl?: string;
  @Output() close = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }
}
