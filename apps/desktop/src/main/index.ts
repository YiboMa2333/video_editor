import { app, BrowserWindow, ipcMain, dialog, Menu, net, protocol } from "electron";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function isRepoRoot(candidatePath: string) {
  const workspaceFile = path.join(candidatePath, "pnpm-workspace.yaml");
  if (existsSync(workspaceFile)) {
    return true;
  }

  const packageJsonPath = path.join(candidatePath, "package.json");
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: string };
    return packageJson.name === "ai-video-editor";
  } catch {
    return false;
  }
}

function findRepoRoot() {
  const searchRoots = [process.cwd(), __dirname];

  for (const startPath of searchRoots) {
    let currentPath = startPath;

    while (true) {
      if (isRepoRoot(currentPath)) {
        return currentPath;
      }

      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        break;
      }
      currentPath = parentPath;
    }
  }

  return path.resolve(__dirname, "../../..");
}

const repoRoot = findRepoRoot();
const projectRoot = path.resolve(repoRoot, "..");
const defaultCacheRoot =
  process.platform === "win32"
    ? "D:\\video_editor_cache\\@ai-video-editor\\desktop"
    : path.join(projectRoot, ".ai-video-editor-cache");
const fallbackCacheRoot = path.join(projectRoot, "_runtime_cache", "desktop-user-data");
const convertedVideoDir = path.join(projectRoot, "converted-videos");
const legacyConvertedVideoDir = path.join(repoRoot, "apps", "converted-videos");

type ClearCacheResult = {
  clearedDirectories: string[];
  failedPaths: Array<{ path: string; error: string }>;
};

function resolveUserDataPath() {
  const requestedPath = process.env.AI_VIDEO_EDITOR_CACHE_DIR ?? defaultCacheRoot;
  const probeDir = path.join(requestedPath, `.write-test-${process.pid}`);

  try {
    mkdirSync(requestedPath, { recursive: true });
    mkdirSync(probeDir);
    rmSync(probeDir, { recursive: true, force: true });
    return requestedPath;
  } catch (error) {
    mkdirSync(fallbackCacheRoot, { recursive: true });
    console.warn(
      `Using fallback userData path because ${requestedPath} is not writable: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return fallbackCacheRoot;
  }
}

const cacheRoot = resolveUserDataPath();

app.setPath("userData", cacheRoot);

function resolveFfmpegPath() {
  const candidates = [
    path.join(process.cwd(), "package.json"),
    path.join(process.cwd(), "apps", "desktop", "package.json"),
  ];

  for (const packageJsonPath of candidates) {
    try {
      const runtimeRequire = createRequire(packageJsonPath);
      return runtimeRequire("ffmpeg-static") as string | null;
    } catch {
      // Try the next likely workspace location.
    }
  }

  return null;
}

const ffmpegPath = resolveFfmpegPath();

let mainWindow: BrowserWindow | null = null;

function toLocalMediaUrl(filePath: string) {
  return `local-media://file?path=${encodeURIComponent(filePath)}`;
}

function toSafeOutputBaseName(fileName: string) {
  const parsedName = path.parse(fileName);
  const baseName = parsedName.name || "video";
  return baseName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
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
    throw new Error("ffmpeg binary is unavailable");
  }

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, ["-v", "quiet", "-print_format", "json", "-show_format", "-i", filePath], {
      windowsHide: true,
    });

    let stdout = "";
    ffmpeg.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        resolve(0); // Default to 0 if duration cannot be determined
        return;
      }

      try {
        const json = JSON.parse(stdout) as { format?: { duration?: string | number } };
        const duration = json.format?.duration;
        const durationSec = typeof duration === "string" ? parseFloat(duration) : typeof duration === "number" ? duration : 0;
        resolve(Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0);
      } catch {
        resolve(0);
      }
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
  const thumbnailDir = path.join(repoRoot, "runtime", "cache", "thumbnails", hash);
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

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+N",
          click: async () => {
            if (mainWindow) {
              await mainWindow.webContents.executeJavaScript(
                'window.dispatchEvent(new CustomEvent("app:new-project"));'
              );
            }
          },
        },
        { type: "separator" },
        {
          label: "Exit",
          accelerator: "CmdOrCtrl+Q",
          click: () => app.quit(),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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

  createMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMenu();
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
