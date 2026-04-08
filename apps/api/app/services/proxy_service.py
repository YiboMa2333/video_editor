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
        # scale=640:-2 forces the computed height to be rounded to the nearest
        # even number. libx264 requires width AND height to be divisible by 2;
        # using -1 can produce an odd height for portrait or non-standard aspect
        # ratios and causes FFmpeg to abort with "height not divisible by 2".
        "scale=640:-2",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        # crf 28 is slightly higher quality than 30; stays well within
        # Chromium's supported H.264 profile/level range.
        "-crf",
        "28",
        "-g",
        "12",
        "-pix_fmt",
        # yuv420p is the only chroma subsampling guaranteed to work in all
        # Chromium/CEF builds (yuv444p and yuv422p are not universally decoded).
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        # +faststart rewrites the moov atom to the beginning of the file so the
        # browser can start decoding before the full download completes.
        "+faststart",
        str(output_file),
    ]

    logger.info(
        "Proxy generation started: %s",
        " ".join(command),
        extra={"input": str(input_file), "output": str(output_file)},
    )

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
