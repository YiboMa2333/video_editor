# Timeline Data Model

This document outlines the data model for the timeline feature of the AI video editor. The timeline is a crucial component that represents the arrangement of media clips, audio tracks, and other elements in a non-destructive editing environment.

## Data Structure

### Project
- **id**: Unique identifier for the project.
- **name**: Name of the project.
- **tracks**: Array of tracks in the timeline.

### Track
- **id**: Unique identifier for the track.
- **type**: Type of track (e.g., video, audio).
- **clips**: Array of clips within the track.

### Clip
- **id**: Unique identifier for the clip.
- **mediaId**: Reference to the media item.
- **start**: Start time of the clip in seconds.
- **duration**: Duration of the clip in seconds.
- **volume**: Volume level for audio clips.
- **fadeIn**: Duration of fade-in effect in seconds.
- **fadeOut**: Duration of fade-out effect in seconds.

### MediaItem
- **id**: Unique identifier for the media item.
- **filePath**: Path to the media file.
- **duration**: Total duration of the media in seconds.
- **width**: Width of the media (for video).
- **height**: Height of the media (for video).
- **audioPresent**: Boolean indicating if the media has an audio track.

### Marker
- **id**: Unique identifier for the marker.
- **time**: Time position of the marker in seconds.
- **label**: Optional label for the marker.

## Relationships
- A **Project** can have multiple **Tracks**.
- A **Track** can contain multiple **Clips**.
- Each **Clip** references a **MediaItem**.
- **Markers** can be associated with a **Track** to indicate important points in the timeline.

## Usage
This data model allows for flexible and efficient management of media elements within the timeline, enabling users to create complex video edits while maintaining a non-destructive workflow.