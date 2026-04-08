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

type ProbeElement = HTMLVideoElement | HTMLAudioElement;

const detectHasAudio = (element: ProbeElement): boolean | undefined => {
  const withAudioHints = element as ProbeElement & {
    mozHasAudio?: boolean;
    webkitAudioDecodedByteCount?: number;
    audioTracks?: { length: number };
  };

  if (typeof withAudioHints.mozHasAudio === "boolean") {
    return withAudioHints.mozHasAudio;
  }

  if (typeof withAudioHints.webkitAudioDecodedByteCount === "number") {
    return withAudioHints.webkitAudioDecodedByteCount > 0;
  }

  if (typeof withAudioHints.audioTracks?.length === "number") {
    return withAudioHints.audioTracks.length > 0;
  }

  return undefined;
};

const probeMediaElement = (element: ProbeElement, source: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const onLoadedMetadata = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Unable to load media metadata."));
    };

    const onTimeout = () => {
      cleanup();
      reject(new Error("Timed out while loading media metadata."));
    };

    const cleanup = () => {
      element.removeEventListener("loadedmetadata", onLoadedMetadata);
      element.removeEventListener("error", onError);
      window.clearTimeout(timeout);
    };

    const timeout = window.setTimeout(onTimeout, 8000);

    element.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
    element.addEventListener("error", onError, { once: true });
    element.preload = "metadata";
    element.src = source;
    element.load();
  });

export async function enrichMediaMetadata(item: MediaItem): Promise<MediaItem> {
  if (item.type !== "video" && item.type !== "audio") {
    return item;
  }

  const source = resolveMediaSource(item.path);
  if (!source) {
    return item;
  }

  const element = document.createElement(item.type === "audio" ? "audio" : "video");

  try {
    await probeMediaElement(element, source);
    const rawDuration = Number.isFinite(element.duration) ? element.duration : undefined;
    const durationSec = rawDuration && rawDuration > 0 ? rawDuration : item.durationSec;
    const hasAudio = item.type === "audio" ? true : detectHasAudio(element);

    return {
      ...item,
      durationSec,
      hasAudio: hasAudio ?? item.hasAudio,
    };
  } catch {
    return item;
  } finally {
    element.removeAttribute("src");
    element.load();
  }
}
