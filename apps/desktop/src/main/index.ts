import { app, BrowserWindow, ipcMain, dialog, net, protocol } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MpvService } from "./mpv/mpvService";
import {
  getRepoRoot,
  getProjectRoot,
  getCacheDir,
  getConvertedVideosDir,
  getRuntimeCacheThumbnailsDir,
  getFfmpegPath,
  getPathsSummary,
} from "./paths";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "local-media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// Log resolved paths at startup for debugging
const pathsSummary = getPathsSummary();
console.log("[startup] Resolved paths:");
console.log(`  Repo Root: ${pathsSummary.repoRoot}`);
console.log(`  Cache Dir: ${pathsSummary.cacheDir}`);
console.log(`  Converted Videos: ${pathsSummary.convertedVideosDir}`);
console.log(`  mpv: ${pathsSummary.mpv.source}${pathsSummary.mpv.exists ? " ✓" : " (not found yet)"}`);
console.log(`  FFmpeg: ${pathsSummary.ffmpeg.path ? "✓" : "⚠ Not bundled yet (will be on first use)"}`);

type ClearCacheResult = {
  clearedDirectories: string[];
  failedPaths: Array<{ path: string; error: string }>;
};

type ExportMode = "single" | "clips";

type ExportClip = {
  id: string;
  mediaId: string;
  startSec: number;
  endSec: number;
  timelineStart?: number;
  timelineEnd?: number;
  timelineStartSec?: number;
  timelineEndSec?: number;
};

type ExportTrack = {
  kind: "video" | "audio" | "subtitle";
  clips: ExportClip[];
};

type ExportMedia = {
  id: string;
  originalPath?: string;
  path?: string;
};

type ExportProjectPayload = {
  name: string;
  media: ExportMedia[];
  tracks: ExportTrack[];
};

type ExportTimelinePayload = {
  mode: ExportMode;
  outputDir: string;
  project: ExportProjectPayload;
};

type ExportTimelineResult = {
  mode: ExportMode;
  outputDir: string;
  outputs: string[];
};

type ExportProgressPayload = {
  mode: ExportMode;
  percent: number;
  message: string;
};

type ExportExecutionContext = {
  cancelled: boolean;
  activeProcess: ChildProcessWithoutNullStreams | null;
};

const EXPORT_CANCELLED_MESSAGE = "Export cancelled by user.";

// Initialize cache directory (resolved via paths.ts)
const cacheRoot = getCacheDir();
const convertedVideoDir = getConvertedVideosDir();
const ffmpegPath = getFfmpegPath();
const legacyConvertedVideoDir = path.join(getProjectRoot(), "apps", "converted-videos");

app.setPath("userData", cacheRoot);

let mainWindow: BrowserWindow | null = null;
const mpvService = new MpvService();
const exportContexts = new Map<number, ExportExecutionContext>();
let previewHostRelativeBounds: { x: number; y: number; width: number; height: number } | null = null;
let previewHostOwnerWindow: BrowserWindow | null = null;
let removeOverlayTrackingListeners: (() => void) | null = null;

function toSafeEmbedBounds(
  bounds: { x: number; y: number; width: number; height: number },
  scaleFactor = 1,
) {
  // Keep embed geometry in logical renderer pixels. Chromium and mpv child
  // placement under --wid align best this way; multiplying by devicePixelRatio
  // can push the child window outside the intended preview region.
  const scale = 1;

  return {
    x: Math.max(0, Math.round(bounds.x * scale)),
    y: Math.max(0, Math.round(bounds.y * scale)),
    width: Math.max(16, Math.round(bounds.width * scale)),
    height: Math.max(16, Math.round(bounds.height * scale)),
  };
}

function toOverlayScreenBounds(
  ownerWindow: BrowserWindow,
  relativeBounds: { x: number; y: number; width: number; height: number },
  scaleFactor = 1,
) {
  const safeRelative = toSafeEmbedBounds(relativeBounds, scaleFactor);
  const contentBounds = ownerWindow.getContentBounds();

  return {
    x: Math.max(0, contentBounds.x + safeRelative.x),
    y: Math.max(0, contentBounds.y + safeRelative.y),
    width: safeRelative.width,
    height: safeRelative.height,
  };
}

function bindOverlayTracking(windowRef: BrowserWindow) {
  removeOverlayTrackingListeners?.();

  const syncOverlay = () => {
    if (!previewHostRelativeBounds) {
      return;
    }

    const overlayBounds = toOverlayScreenBounds(windowRef, previewHostRelativeBounds, 1);
    void mpvService.updateOverlayBounds(overlayBounds).catch((error) => {
      console.warn("[mpv] failed to sync overlay bounds", error);
    });
  };

  windowRef.on("move", syncOverlay);
  windowRef.on("resize", syncOverlay);

  removeOverlayTrackingListeners = () => {
    windowRef.removeListener("move", syncOverlay);
    windowRef.removeListener("resize", syncOverlay);
  };
}

function toLocalMediaUrl(filePath: string) {
  return `local-media://file?path=${encodeURIComponent(filePath)}`;
}

function toSafeOutputBaseName(fileName: string) {
  const parsedName = path.parse(fileName);
  const baseName = parsedName.name || "video";
  return baseName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
}

function getClipTimelineStart(clip: ExportClip) {
  if (typeof clip.timelineStart === "number") {
    return clip.timelineStart;
  }

  if (typeof clip.timelineStartSec === "number") {
    return clip.timelineStartSec;
  }

  return 0;
}

function getOrderedVideoExportClips(project: ExportProjectPayload) {
  const videoTrack = project.tracks.find((track) => track.kind === "video");
  if (!videoTrack) {
    return [] as ExportClip[];
  }

  return [...videoTrack.clips].sort((a, b) => getClipTimelineStart(a) - getClipTimelineStart(b));
}

function getSourcePath(media: ExportMedia) {
  return media.originalPath || media.path || "";
}

function ensureExportNotCancelled(context?: ExportExecutionContext) {
  if (context?.cancelled) {
    throw new Error(EXPORT_CANCELLED_MESSAGE);
  }
}

async function runFfmpeg(args: string[], context?: ExportExecutionContext) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary is unavailable");
  }

  ensureExportNotCancelled(context);

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });
    if (context) {
      context.activeProcess = ffmpeg;
    }

    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (context) {
        context.activeProcess = null;
      }

      if (context?.cancelled) {
        reject(new Error(EXPORT_CANCELLED_MESSAGE));
        return;
      }

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

async function exportClipSegment(
  sourcePath: string,
  clip: ExportClip,
  outputPath: string,
  context?: ExportExecutionContext,
) {
  const sourceStart = Math.max(0, clip.startSec);
  const sourceEnd = Math.max(sourceStart, clip.endSec);
  const duration = Math.max(0.01, sourceEnd - sourceStart);

  await runFfmpeg([
    "-y",
    "-ss",
    String(sourceStart),
    "-t",
    String(duration),
    "-i",
    sourcePath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-c:v",
    "libx264",
    "-profile:v",
    "baseline",
    "-level",
    "3.0",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-b:a",
    "128k",
    outputPath,
  ], context);
}

async function exportTimeline(
  payload: ExportTimelinePayload,
  onProgress?: (progress: ExportProgressPayload) => void,
  context?: ExportExecutionContext,
): Promise<ExportTimelineResult> {
  if (!payload.outputDir) {
    throw new Error("Missing export output directory.");
  }

  await mkdir(payload.outputDir, { recursive: true });

  const orderedClips = getOrderedVideoExportClips(payload.project);
  if (orderedClips.length === 0) {
    throw new Error("No video clips available to export.");
  }

  const mediaById = new Map(payload.project.media.map((item) => [item.id, item]));

  const clipSources = orderedClips.map((clip) => {
    const media = mediaById.get(clip.mediaId);
    if (!media) {
      throw new Error(`Missing media for clip ${clip.id}.`);
    }

    const sourcePath = getSourcePath(media);
    if (!sourcePath || !existsSync(sourcePath)) {
      throw new Error(`Source media not found for clip ${clip.id}: ${sourcePath || "(empty path)"}`);
    }

    return { clip, sourcePath };
  });

  const reportProgress = (percent: number, message: string) => {
    onProgress?.({
      mode: payload.mode,
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      message,
    });
  };

  reportProgress(0, "Starting export");

  if (payload.mode === "clips") {
    const outputs: string[] = [];
    const total = clipSources.length;

    for (let i = 0; i < clipSources.length; i += 1) {
      ensureExportNotCancelled(context);
      const outputPath = path.join(payload.outputDir, `clip ${i + 1}.mp4`);
      await exportClipSegment(clipSources[i].sourcePath, clipSources[i].clip, outputPath, context);
      outputs.push(outputPath);
      reportProgress(((i + 1) / total) * 100, `Exporting clips ${i + 1}/${total}`);
    }

    reportProgress(100, "Export complete");

    return {
      mode: payload.mode,
      outputDir: payload.outputDir,
      outputs,
    };
  }

  const tempDir = path.join(payload.outputDir, `.ai-video-editor-export-tmp-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  try {
    const segmentPaths: string[] = [];
    const totalSteps = clipSources.length + 1;

    for (let i = 0; i < clipSources.length; i += 1) {
      ensureExportNotCancelled(context);
      const segmentPath = path.join(tempDir, `segment_${String(i + 1).padStart(4, "0")}.mp4`);
      await exportClipSegment(clipSources[i].sourcePath, clipSources[i].clip, segmentPath, context);
      segmentPaths.push(segmentPath);
      reportProgress(((i + 1) / totalSteps) * 100, `Rendering segment ${i + 1}/${clipSources.length}`);
    }

    const concatListPath = path.join(tempDir, "concat.txt");
    const concatLines = segmentPaths
      .map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`)
      .join("\n");

    await writeFile(concatListPath, `${concatLines}\n`, "utf8");

    const mergedOutputPath = path.join(
      payload.outputDir,
      `${toSafeOutputBaseName(payload.project.name || "timeline")}_merged.mp4`,
    );

    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListPath,
      "-c:v",
      "libx264",
      "-profile:v",
      "baseline",
      "-level",
      "3.0",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-b:a",
      "128k",
      mergedOutputPath,
    ], context);

    reportProgress(100, "Merging complete");

    return {
      mode: payload.mode,
      outputDir: payload.outputDir,
      outputs: [mergedOutputPath],
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function getConvertedOutputPath(fileName: string) {
  return path.join(convertedVideoDir, `converted_${toSafeOutputBaseName(fileName)}.mp4`);
}

async function createPreviewAsset(filePath: string, originalFileName = path.basename(filePath)) {
  const previewDir = convertedVideoDir;
  await mkdir(previewDir, { recursive: true });

  const previewPath = getConvertedOutputPath(originalFileName);

  if (!ffmpegPath) {
    throw new Error("ffmpeg binary is unavailable");
  }

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(
      ffmpegPath,
      [
        "-y",
        "-i",
        filePath,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c:v",
        "libx264",
        "-profile:v",
        "baseline",
        "-level",
        "3.0",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-b:a",
        "128k",
        previewPath,
      ],
      { windowsHide: true }
    );

    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });

  return toLocalMediaUrl(previewPath);
}

async function createPreviewFromBuffer(fileName: string, bytes: Uint8Array) {
  const importCacheDir = path.join(app.getPath("userData"), "import-cache");
  await mkdir(importCacheDir, { recursive: true });

  const extension = path.extname(fileName) || ".mp4";
  const sourceHash = createHash("sha1").update(bytes).digest("hex");
  const sourcePath = path.join(importCacheDir, `${sourceHash}${extension}`);

  try {
    await stat(sourcePath);
  } catch {
    await writeFile(sourcePath, bytes);
  }

  return createPreviewAsset(sourcePath, fileName);
}

async function getVideoDuration(filePath: string): Promise<number> {
  if (!ffmpegPath) {
    return 0;
  }

  return new Promise((resolve) => {
    // Run ffmpeg with just the input — it exits with code 1 (no output file)
    // but always writes "Duration: HH:MM:SS.ss" to stderr before exiting.
    const ffmpeg = spawn(ffmpegPath, ["-v", "info", "-i", filePath], {
      windowsHide: true,
    });

    let stderr = "";
    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    ffmpeg.on("close", () => {
      const match = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(stderr);
      if (!match) {
        resolve(0);
        return;
      }
      const secs =
        parseInt(match[1], 10) * 3600 +
        parseInt(match[2], 10) * 60 +
        parseFloat(match[3]);
      resolve(Number.isFinite(secs) && secs > 0 ? secs : 0);
    });

    ffmpeg.on("error", () => resolve(0));
  });
}

function calculateOptimalFps(durationSec: number): number {
  if (durationSec <= 0) {
    return 1.0; // Default fps
  }

  // Adaptive fps based on duration to keep frame count reasonable
  // Target: 500-3000 frames per video
  if (durationSec < 300) {
    // <= 5 min: 1 frame per second (300 frames max)
    return 1.0;
  } else if (durationSec < 1800) {
    // <= 30 min: 1 frame per 2 seconds (900 frames max)
    return 0.5;
  } else if (durationSec < 7200) {
    // <= 2 hours: 1 frame per 5 seconds (1440 frames max)
    return 0.2;
  } else {
    // > 2 hours: 1 frame per 10 seconds (720 frames max for 2 hours)
    return 0.1;
  }
}

async function createThumbnailsAsset(filePath: string, fps?: number) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary is unavailable");
  }

  // If fps not specified, determine optimal fps based on video duration
  let safeFps = fps;
  if (!Number.isFinite(safeFps) || safeFps === undefined) {
    const durationSec = await getVideoDuration(filePath);
    safeFps = calculateOptimalFps(durationSec);
  } else {
    safeFps = Math.max(0.1, safeFps);
  }

  const hash = createHash("sha1").update(filePath).digest("hex").slice(0, 16);
  const thumbnailDir = path.join(getRuntimeCacheThumbnailsDir(), hash);
  await mkdir(thumbnailDir, { recursive: true });

  const outputPattern = path.join(thumbnailDir, "thumb_%04d.jpg");

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(
      ffmpegPath,
      [
        "-y",
        "-i",
        filePath,
        "-vf",
        `fps=${safeFps}`,
        "-q:v",
        "2",
        outputPattern,
      ],
      { windowsHide: true }
    );

    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });

  const files = await readdir(thumbnailDir);
  const count = files.filter((name) => /^thumb_\d+\.jpg$/i.test(name)).length;

  return {
    thumbnailDir,
    thumbnailFps: safeFps,
    count,
  };
}

async function clearDirectoryContents(directoryPath: string, result: ClearCacheResult) {
  try {
    await mkdir(directoryPath, { recursive: true });
    const entries = await readdir(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
      const targetPath = path.join(directoryPath, entry.name);
      try {
        await rm(targetPath, {
          recursive: true,
          force: true,
          maxRetries: 2,
          retryDelay: 80,
        });
      } catch (error) {
        result.failedPaths.push({
          path: targetPath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    result.clearedDirectories.push(directoryPath);
  } catch (error) {
    result.failedPaths.push({
      path: directoryPath,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function clearAppCaches(): Promise<ClearCacheResult> {
  const result: ClearCacheResult = {
    clearedDirectories: [],
    failedPaths: [],
  };

  await clearDirectoryContents(convertedVideoDir, result);
  await clearDirectoryContents(legacyConvertedVideoDir, result);
  await clearDirectoryContents(path.join(app.getPath("userData"), "import-cache"), result);
  await clearDirectoryContents(path.join(app.getPath("userData"), "preview-cache"), result);

  return result;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  protocol.handle("local-media", (request) => {
    const url = new URL(request.url);
    const mediaPath = url.searchParams.get("path");

    if (!mediaPath) {
      return new Response("Missing media path", { status: 400 });
    }

    return net.fetch(pathToFileURL(mediaPath).toString());
  });

  ipcMain.handle("dialog:openMediaFile", async () => {
    const result = await dialog.showOpenDialog({
      title: "Import Media",
      properties: ["openFile"],
      filters: [
        { name: "Media", extensions: ["mp4", "mov", "mkv", "mp3", "wav", "aac"] },
        { name: "All files", extensions: ["*"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("dialog:selectExportFolder", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select Export Folder",
      properties: ["openDirectory", "createDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle("media:createPreview", async (_event, filePath: string) => {
    return createPreviewAsset(filePath);
  });

  ipcMain.handle(
    "media:createPreviewFromBuffer",
    async (_event, payload: { fileName: string; bytes: Uint8Array }) => {
      return createPreviewFromBuffer(payload.fileName, payload.bytes);
    }
  );

  ipcMain.handle("media:createThumbnails", async (_event, filePath: string) => {
    return createThumbnailsAsset(filePath);
  });

  ipcMain.handle("app:clearCaches", async () => {
    return clearAppCaches();
  });

  ipcMain.handle("export:timeline", async (event, payload: ExportTimelinePayload) => {
    const senderId = event.sender.id;
    const context: ExportExecutionContext = {
      cancelled: false,
      activeProcess: null,
    };

    exportContexts.set(senderId, context);

    try {
      return await exportTimeline(
        payload,
        (progress) => {
          event.sender.send("export:progress", progress);
        },
        context,
      );
    } finally {
      exportContexts.delete(senderId);
    }
  });

  ipcMain.handle("export:cancel", async (event) => {
    const context = exportContexts.get(event.sender.id);
    if (!context) {
      return { ok: false, message: "No active export to cancel." };
    }

    context.cancelled = true;

    if (context.activeProcess && !context.activeProcess.killed) {
      context.activeProcess.kill();
    }

    return { ok: true };
  });

  ipcMain.handle("mpv:status", () => {
    return mpvService.getStatus();
  });

  ipcMain.handle(
    "mpv:attachPreviewHost",
    async (
      event,
      payload: {
        bounds: { x: number; y: number; width: number; height: number };
        scaleFactor?: number;
      }
    ) => {
      try {
        const ownerWindow = BrowserWindow.fromWebContents(event.sender);
        if (!ownerWindow) {
          return { ok: false, error: "Unable to resolve owner BrowserWindow for preview host." };
        }

        previewHostOwnerWindow = ownerWindow;
        previewHostRelativeBounds = payload.bounds;
        bindOverlayTracking(ownerWindow);

        const bounds = toOverlayScreenBounds(ownerWindow, payload.bounds, payload.scaleFactor);

        console.log("[mpv] attaching overlay preview host", {
          bounds,
          scaleFactor: payload.scaleFactor,
        });

        mpvService.setOverlayHost({ bounds });
        await mpvService.updateOverlayBounds(bounds);

        return { ok: true };
      } catch (error) {
        console.warn("[mpv] failed to attach overlay host, keeping fallback mode", error);
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  ipcMain.handle(
    "mpv:updatePreviewHostBounds",
    async (
      event,
      payload: {
        bounds: { x: number; y: number; width: number; height: number };
        scaleFactor?: number;
      }
    ) => {
      try {
        const ownerWindow = BrowserWindow.fromWebContents(event.sender) ?? previewHostOwnerWindow;
        if (!ownerWindow) {
          return { ok: false, error: "No owner window available for overlay bounds update." };
        }

        previewHostRelativeBounds = payload.bounds;
        const bounds = toOverlayScreenBounds(ownerWindow, payload.bounds, payload.scaleFactor);
        await mpvService.updateOverlayBounds(bounds);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  ipcMain.handle("mpv:detachPreviewHost", async () => {
    mpvService.clearOverlayHost();
    previewHostRelativeBounds = null;
    previewHostOwnerWindow = null;
    removeOverlayTrackingListeners?.();
    removeOverlayTrackingListeners = null;

    try {
      await mpvService.stop();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("mpv:loadFile", async (_event, filePath: string) => {
    try {
      await mpvService.loadFile(filePath);
      return { ok: true };
    } catch (error) {
      console.error("[mpv] loadFile failed", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("mpv:seek", async (_event, timeSec: number) => {
    try {
      await mpvService.seek(timeSec);
      return { ok: true };
    } catch (error) {
      console.error("[mpv] seek failed", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("mpv:play", async () => {
    try {
      await mpvService.play();
      return { ok: true };
    } catch (error) {
      console.error("[mpv] play failed", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("mpv:pause", async () => {
    try {
      await mpvService.pause();
      return { ok: true };
    } catch (error) {
      console.error("[mpv] pause failed", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("mpv:stop", async () => {
    try {
      await mpvService.stop();
      return { ok: true };
    } catch (error) {
      console.error("[mpv] stop failed", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("mpv:setVolume", async (_event, volumePercent: number) => {
    try {
      await mpvService.setVolume(volumePercent);
      return { ok: true };
    } catch (error) {
      console.error("[mpv] setVolume failed", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // MVP UI decision: we intentionally avoid native app menus so File/View/Edit
  // actions live in the editor surface, next to timeline and preview controls.
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  await mpvService.shutdown();
});
