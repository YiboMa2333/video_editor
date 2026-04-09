import type { ReactNode } from "react";
import "./MainEditorLayout.css";

interface MainEditorLayoutProps {
  mediaList: ReactNode;
  previewWindow: ReactNode;
  playbackInfo: ReactNode;
  editorControls: ReactNode;
  timelineToolbar: ReactNode;
  timeline: ReactNode;
}

export default function MainEditorLayout({
  mediaList,
  previewWindow,
  playbackInfo,
  editorControls,
  timelineToolbar,
  timeline,
}: MainEditorLayoutProps) {
  return (
    <div className="main-editor-layout">
      <aside className="media-sidebar">{mediaList}</aside>

      <section className="editor-stage" aria-label="Video editing workspace">
        <div className="editor-preview-stack">
          <div className="preview-window-region">{previewWindow}</div>
          <div className="playback-info-region">{playbackInfo}</div>
          <div className="editor-controls-region">{editorControls}</div>
        </div>

        <div className="timeline-toolbar-region">{timelineToolbar}</div>
        <div className="timeline-region">{timeline}</div>
      </section>
    </div>
  );
}