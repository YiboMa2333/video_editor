from __future__ import annotations

import logging
import subprocess
from pathlib import Path
from typing import List

logger = logging.getLogger(__name__)


def generate_thumbnails(input_path: str, output_dir: str, fps: float = 1.0) -> List[str]:
    """Generate timeline thumbnails from media using ffmpeg.

    Timeline thumbnails improve scrubbing/navigation performance because the UI
    can show pre-extracted still frames instead of forcing frequent video decode
    work while the user drags across the timeline.
    """

    input_file = Path(input_path)
    out_dir = Path(output_dir)

    if not input_file.exists():
        raise FileNotFoundError(f"Input media not found: {input_file}")

    out_dir.mkdir(parents=True, exist_ok=True)
    output_pattern = out_dir / "thumb_%04d.jpg"

    # Thumbnail FPS trades quality/granularity vs disk/CPU usage.
    # Higher FPS gives denser visual guidance but creates more files.
    safe_fps = max(0.1, fps)

    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_file),
        "-vf",
        f"fps={safe_fps}",
        "-q:v",
        "2",
        str(output_pattern),
    ]

    logger.info(
        "Thumbnail generation started",
        extra={"input": str(input_file), "output_dir": str(out_dir), "fps": safe_fps},
    )

    try:
        completed = subprocess.run(command, check=True, capture_output=True, text=True)
        if completed.stderr:
            logger.debug("FFmpeg thumbnail stderr", extra={"stderr": completed.stderr[-2000:]})
    except subprocess.CalledProcessError as exc:
        logger.exception(
            "Thumbnail generation failed",
            extra={
                "input": str(input_file),
                "output_dir": str(out_dir),
                "returncode": exc.returncode,
                "stderr": (exc.stderr or "")[-4000:],
            },
        )
        raise RuntimeError(f"Failed to generate thumbnails for {input_file}") from exc

    files = sorted(str(path) for path in out_dir.glob("thumb_*.jpg"))
    logger.info("Thumbnail generation completed", extra={"count": len(files), "output_dir": str(out_dir)})
    return files
