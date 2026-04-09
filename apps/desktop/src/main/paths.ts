/**
 * Centralized path resolution for the AI Video Editor desktop app.
 * Handles:
 * - Cache directory (configurable via env var, OS-specific default)
 * - Tools directory (mpv, python, etc.)
 * - Converted videos directory
 * - Thumbnail/preview cache
 *
 * All paths are resolved once at startup and can be accessed via the
 * exported functions. This avoids scattered hardcoded paths throughout
 * the codebase and makes it easy for new users to reconfigure.
 */

import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolves the repository root by walking up from the main process directory
 * and looking for pnpm-workspace.yaml or package.json with name "ai-video-editor".
 */
export function getRepoRoot(): string {
  function isRepoRoot(candidatePath: string): boolean {
    const workspaceFile = path.join(candidatePath, "pnpm-workspace.yaml");
    if (existsSync(workspaceFile)) {
      return true;
    }

    const packageJsonPath = path.join(candidatePath, "package.json");
    if (!existsSync(packageJsonPath)) {
      return false;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { readFileSync } = require("node:fs");
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
        name?: string;
      };
      return packageJson.name === "ai-video-editor";
    } catch {
      return false;
    }
  }

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

  // Fallback: relative to compiled main/index.js location
  return path.resolve(__dirname, "../../..");
}

/**
 * Resolves the parent directory of the repo (where converted-videos, _runtime_cache, etc. go).
 */
export function getProjectRoot(): string {
  return path.resolve(getRepoRoot(), "..");
}

/**
 * Resolves the tools directory.
 * By default: [repoRoot]/tools
 * Can be overridden via AI_VIDEO_EDITOR_TOOLS_DIR env var.
 *
 * This directory should contain subdirectories like:
 * - tools/mpv/mpv.exe
 * - tools/python/ (optional)
 * - tools/ffmpeg/ (auto-managed by ffmpeg-static)
 */
export function getToolsDir(): string {
  const envPath = process.env.AI_VIDEO_EDITOR_TOOLS_DIR;
  if (envPath) {
    return path.resolve(envPath);
  }
  return path.join(getRepoRoot(), "tools");
}

/**
 * Resolves the primary cache directory for app user data (Electron userData).
 * Priority:
 * 1. Environment variable AI_VIDEO_EDITOR_CACHE_DIR
 * 2. OS-specific default:
 *    - Windows: %APPDATA%\ai-video-editor\cache
 *    - macOS: ~/Library/Caches/ai-video-editor
 *    - Linux: ~/.cache/ai-video-editor
 * 3. Fallback: [projectRoot]/_runtime_cache/desktop-user-data
 *
 * Returns the path that is actually writable (with fallback).
 */
export function getCacheDir(): string {
  const envPath = process.env.AI_VIDEO_EDITOR_CACHE_DIR;

  let candidatePath: string;
  if (envPath) {
    candidatePath = path.resolve(envPath);
  } else {
    // OS-specific default
    if (process.platform === "win32") {
      const appData = process.env.APPDATA;
      if (!appData) {
        throw new Error("APPDATA environment variable not set");
      }
      candidatePath = path.join(appData, "ai-video-editor", "cache");
    } else if (process.platform === "darwin") {
      candidatePath = path.join(process.env.HOME!, "Library", "Caches", "ai-video-editor");
    } else {
      // Linux and others
      const xdgCache = process.env.XDG_CACHE_HOME;
      if (xdgCache) {
        candidatePath = path.join(xdgCache, "ai-video-editor");
      } else {
        candidatePath = path.join(process.env.HOME!, ".cache", "ai-video-editor");
      }
    }
  }

  // Test if candidatePath is writable
  const fallbackPath = path.join(getProjectRoot(), "_runtime_cache", "desktop-user-data");

  try {
    mkdirSync(candidatePath, { recursive: true });
    const probeDir = path.join(candidatePath, `.write-test-${process.pid}`);
    mkdirSync(probeDir);
    rmSync(probeDir, { recursive: true, force: true });
    return candidatePath;
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);
    console.warn(
      `[paths] Cache directory not writable: ${candidatePath}. ` +
        `Using fallback: ${fallbackPath}. Reason: ${errorMsg}`
    );
    mkdirSync(fallbackPath, { recursive: true });
    return fallbackPath;
  }
}

/**
 * Resolves the directory where converted (preview-safe) videos are stored.
 * Default: [projectRoot]/converted-videos
 * Can be overridden via AI_VIDEO_EDITOR_CONVERTED_VIDEOS_DIR env var.
 */
export function getConvertedVideosDir(): string {
  const envPath = process.env.AI_VIDEO_EDITOR_CONVERTED_VIDEOS_DIR;
  if (envPath) {
    return path.resolve(envPath);
  }
  return path.join(getProjectRoot(), "converted-videos");
}

/**
 * Resolves the directory where thumbnails/preview frames are cached.
 * This is inside the repo at: [repoRoot]/runtime/cache/thumbnails
 * Created on demand during thumbnail generation.
 */
export function getRuntimeCacheThumbnailsDir(): string {
  return path.join(getRepoRoot(), "runtime", "cache", "thumbnails");
}

/**
 * Resolves the mpv binary path.
 * Priority:
 * 1. Environment variable AI_VIDEO_EDITOR_MPV_PATH
 * 2. [toolsDir]/mpv/mpv.exe (Windows) or [toolsDir]/mpv/mpv (Unix)
 * 3. Standard Windows installation: C:\Program Files\MPV Player\mpv.exe
 * 4. Fall back to "mpv" (expects it on PATH)
 *
 * Returns the full path to mpv executable, even if it doesn't exist yet.
 * Caller should validate existence before launch.
 */
export function getDetailedMpvPath(): {
  path: string;
  source: string;
  exists: boolean;
} {
  // Check environment variable
  const envPath = process.env.AI_VIDEO_EDITOR_MPV_PATH;
  if (envPath && existsSync(envPath)) {
    return { path: envPath, source: "AI_VIDEO_EDITOR_MPV_PATH (env var)", exists: true };
  }

  // Check tools directory
  const toolsDir = getToolsDir();
  const candidates = [
    process.platform === "win32"
      ? path.join(toolsDir, "mpv", "mpv.exe")
      : path.join(toolsDir, "mpv", "mpv"),
  ];

  // Add standard Windows installation
  if (process.platform === "win32") {
    candidates.push("C:\\Program Files\\MPV Player\\mpv.exe");
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return {
        path: candidate,
        source:
          candidate.includes("tools") ? `tools directory (${toolsDir})` : "standard installation",
        exists: true,
      };
    }
  }

  // Return best fallback (expected to be on PATH)
  const fallback = "mpv";
  return {
    path: fallback,
    source: "system PATH",
    exists: false,
  };
}

/**
 * Convenience method to get just the mpv path.
 * For checking existence and launching.
 */
export function getMpvPath(): string {
  return getDetailedMpvPath().path;
}

/**
 * Resolves FFmpeg binary path using ffmpeg-static.
 * Tries to require ffmpeg-static from workspace package.json locations.
 * Returns null if not found (user needs to run pnpm install).
 */
export function getFfmpegPath(): string | null {
  const repoRoot = getRepoRoot();
  const candidates = [
    path.join(repoRoot, "package.json"),
    path.join(repoRoot, "apps", "desktop", "package.json"),
  ];

  for (const packageJsonPath of candidates) {
    try {
      // Note: In ESM context, createRequire is needed to load ffmpeg-static
      const { createRequire } = require("node:module");
      const runtimeRequire = createRequire(packageJsonPath);
      const ffmpegPath = runtimeRequire("ffmpeg-static") as string | null;
      if (ffmpegPath && existsSync(ffmpegPath)) {
        return ffmpegPath;
      }
    } catch {
      // Continue to next candidate
    }
  }

  return null;
}

/**
 * Summary of all resolved paths. Useful for logging at startup.
 */
export function getPathsSummary(): {
  repoRoot: string;
  projectRoot: string;
  toolsDir: string;
  cacheDir: string;
  convertedVideosDir: string;
  runtimeCacheThumbnailsDir: string;
  mpv: {
    path: string;
    source: string;
    exists: boolean;
  };
  ffmpeg: {
    path: string | null;
  };
} {
  return {
    repoRoot: getRepoRoot(),
    projectRoot: getProjectRoot(),
    toolsDir: getToolsDir(),
    cacheDir: getCacheDir(),
    convertedVideosDir: getConvertedVideosDir(),
    runtimeCacheThumbnailsDir: getRuntimeCacheThumbnailsDir(),
    mpv: getDetailedMpvPath(),
    ffmpeg: {
      path: getFfmpegPath(),
    },
  };
}
