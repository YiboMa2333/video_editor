from __future__ import annotations

import json
import logging
import subprocess
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter

from ...models.media import ImportMediaRequest, MediaResponse
from ...services.proxy_service import generate_proxy_video

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/media", tags=["media"])


def _find_repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "runtime").exists() and (parent / "apps").exists():
            return parent
    return current.parents[5]


def _probe_media(input_path: str) -> tuple[Optional[float], Optional[bool]]:
    """Best-effort metadata probe via ffprobe. Returns (duration, has_audio)."""

    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=codec_type",
        "-of",
        "json",
        input_path,
    ]

    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        payload = json.loads(result.stdout or "{}")
        duration_val = payload.get("format", {}).get("duration")
        duration = float(duration_val) if duration_val is not None else None

        streams = payload.get("streams") or []
        has_audio = any(stream.get("codec_type") == "audio" for stream in streams)
        return duration, has_audio
    except Exception:
        logger.exception("Failed to probe media metadata", extra={"input": input_path})
        return None, None


@router.post("/import", response_model=MediaResponse)
def import_media(payload: ImportMediaRequest) -> MediaResponse:
    """Import media and generate a lightweight proxy used for editor preview.

    If proxy generation fails, we still return the original media path so the UI
    can continue with fallback playback.
    """

    media_id = str(uuid.uuid4())
    repo_root = _find_repo_root()
    proxy_dir = repo_root / "runtime" / "cache" / "proxies"
    proxy_dir.mkdir(parents=True, exist_ok=True)
    proxy_path = proxy_dir / f"{media_id}.mp4"

    duration, has_audio = _probe_media(payload.originalPath)

    try:
        generated_proxy = generate_proxy_video(payload.originalPath, str(proxy_path))
        return MediaResponse(
            id=media_id,
            originalPath=payload.originalPath,
            proxyPath=generated_proxy,
            duration=duration,
            hasAudio=has_audio,
            isProxyReady=True,
        )
    except Exception:
        logger.exception(
            "Proxy generation failed during import",
            extra={"media_id": media_id, "original": payload.originalPath, "proxy": str(proxy_path)},
        )
        return MediaResponse(
            id=media_id,
            originalPath=payload.originalPath,
            proxyPath=None,
            duration=duration,
            hasAudio=has_audio,
            isProxyReady=False,
        )
