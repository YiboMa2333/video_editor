import type { MediaItem } from "./media";
import type { Track, Marker, AIAnnotation } from "./timeline";
import type { Subtitle } from "./subtitle";

export interface Project {
  id: string;
  name: string;
  media: MediaItem[];
  tracks: Track[];
  subtitles: Subtitle[];
  markers: Marker[];
  annotations: AIAnnotation[];
  createdAt: string;
  updatedAt: string;
}
