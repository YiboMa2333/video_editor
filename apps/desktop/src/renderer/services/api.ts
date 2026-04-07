import type { MediaItem } from "../types/media";

function detectMediaType(name: string): MediaItem["type"] {
  const ext = name.split(".").pop()?.toLowerCase();

  return ext && ["mp4", "mov", "mkv"].includes(ext)
    ? "video"
    : ext && ["mp3", "wav", "aac"].includes(ext)
      ? "audio"
      : ext && ["png", "jpg", "jpeg", "webp"].includes(ext)
        ? "image"
        : "unknown";
}

export async function checkBackendHealth(): Promise<"online" | "offline"> {
  try {
    const res = await fetch("http://127.0.0.1:8000/health");
    if (!res.ok) return "offline";
    return "online";
  } catch {
    return "offline";
  }
}

export function createLocalMediaStub(filePath: string): MediaItem {
  const name = filePath.split(/[\\/]/).pop() ?? "unknown";

  return {
    id: crypto.randomUUID(),
    name,
    path: filePath,
    type: detectMediaType(name),
  };
}

export function createBrowserMediaStub(file: File): MediaItem {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    path: URL.createObjectURL(file),
    type: detectMediaType(file.name),
  };
}

export function resolveMediaSource(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }

  if (/^(blob:|https?:|file:|local-media:)/i.test(path)) {
    return path;
  }

  if (/^[a-zA-Z]:\\/.test(path)) {
    return `local-media://file?path=${encodeURIComponent(path)}`;
  }

  return path;
}
