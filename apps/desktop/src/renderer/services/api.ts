import type { MediaItem } from "../types/media";

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
  const ext = name.split(".").pop()?.toLowerCase();

  const type: MediaItem["type"] =
    ext && ["mp4", "mov", "mkv"].includes(ext)
      ? "video"
      : ext && ["mp3", "wav", "aac"].includes(ext)
        ? "audio"
        : ext && ["png", "jpg", "jpeg", "webp"].includes(ext)
          ? "image"
          : "unknown";

  return {
    id: crypto.randomUUID(),
    name,
    path: filePath,
    type,
  };
}
