# Timeline Engine Utilities

This project provides a set of reusable TypeScript utilities for timeline editing in a non-destructive video editor. The utilities are designed to facilitate various editing operations on video clips, allowing for efficient manipulation of timeline data without directly modifying the original media files.

## Utilities Overview

### Functions Included

- **splitClip**: Splits a clip at a specified playhead time, returning two new clips representing the left and right segments.
  
- **deleteRange**: Deletes a specified time range from the timeline, adjusting the remaining clips accordingly to ensure a seamless timeline.

- **duplicateClip**: Creates a duplicate of a given clip, assigning a new ID and preserving the original clip's properties.

- **moveClip**: Moves a clip to a new start time on the timeline while maintaining its duration.

## Installation

To install the timeline engine utilities, clone the repository and run:

```bash
npm install
```

## Usage

Import the desired utility function from the package:

```typescript
import { splitClip, deleteRange, duplicateClip, moveClip } from 'timeline-engine';
```

### Examples

#### Splitting a Clip

```typescript
const newClips = splitClip(originalClip, playheadTime);
```

#### Deleting a Range

```typescript
const updatedClips = deleteRange(clips, startTime, endTime);
```

#### Duplicating a Clip

```typescript
const newClip = duplicateClip(originalClip);
```

#### Moving a Clip

```typescript
const movedClip = moveClip(originalClip, newStartTime);
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.