from __future__ import annotations

import logging

from fastapi import FastAPI

from .api.routes.media import router as media_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="AI Video Editor API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(media_router)
