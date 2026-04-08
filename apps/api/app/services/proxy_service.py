from __future__ import annotations

import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def generate_proxy_video(input_path: str, output_path: str) -> str:
    """Generate a lightweight proxy video for smooth editor preview playback.

    Why proxy videos are needed:
    - Original source files can be high bitrate/high resolution and expensive to decode.
    - Editing UI interactions (scrubbing, seeking) need fast, low-latency frame access.

    Why frequent keyframes help scrubbing:
    - Video decoders usually seek to a nearby keyframe first.
    - A smaller GOP (e.g. ``-g 12``) inserts keyframes more often, reducing seek distance
      and making timeline scrubbing feel more responsive.

    Why original video is still required for export:
    - Proxy files are intentionally lower quality.
    - Final renders should use original media to preserve detail and fidelity.
    """

    input_file = Path(input_path)
    output_file = Path(output_path)

    if not input_file.exists():
        raise FileNotFoundError(f"Input media not found: {input_file}")

    output_file.parent.mkdir(parents=True, exist_ok=True)

    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_file),
        "-vf",
        "scale=640:-1",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "30",
        "-g",
        "12",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        str(output_file),
    ]

    logger.info("Proxy generation started", extra={"input": str(input_file), "output": str(output_file)})

    try:
        completed = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )
        if completed.stderr:
            logger.debug("FFmpeg proxy generation stderr", extra={"stderr": completed.stderr[-2000:]})
    except subprocess.CalledProcessError as exc:
        logger.exception(
            "Proxy generation failed",
            extra={
                "input": str(input_file),
                "output": str(output_file),
                "returncode": exc.returncode,
                "stderr": (exc.stderr or "")[-4000:],
            },
        )
        raise RuntimeError(f"Failed to generate proxy video for {input_file}") from exc

    logger.info("Proxy generation completed", extra={"output": str(output_file)})
    return str(output_file)
