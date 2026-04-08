from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ImportMediaRequest(BaseModel):
    originalPath: str = Field(..., description="Absolute path to imported source media.")


class MediaResponse(BaseModel):
    id: str
    originalPath: str
    proxyPath: Optional[str] = None
    duration: Optional[float] = None
    hasAudio: Optional[bool] = None
    isProxyReady: bool = False
