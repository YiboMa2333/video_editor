import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createConnection, type Socket } from "node:net";
import { existsSync } from "node:fs";

export type MpvStatus = {
  available: boolean;
  connected: boolean;
  mode: "overlay-window" | "external-window-mvp" | "external-fallback";
  lastError: string | null;
};

type MpvCommand = {
  command: Array<string | number | boolean>;
  request_id?: number;
};

type MpvOverlayHostConfig = {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

const DEFAULT_WINDOWS_PIPE = `\\\\.\\pipe\\ai-video-editor-mpv-${process.pid}`;

export class MpvService {
  private mpvProcess: ChildProcessWithoutNullStreams | null = null;

  private ipcSocket: Socket | null = null;

  private requestId = 0;

  private connectingPromise: Promise<void> | null = null;

  private lastError: string | null = null;

  private readonly ipcPath: string;

  private readonly mpvBinaryPath: string;

  private mode: MpvStatus["mode"] = "external-window-mvp";

  private overlayHostConfig: MpvOverlayHostConfig | null = null;

  constructor() {
    this.ipcPath = process.env.AI_VIDEO_EDITOR_MPV_PIPE || DEFAULT_WINDOWS_PIPE;
    this.mpvBinaryPath = this.resolveMpvBinaryPath();
  }

  getStatus(): MpvStatus {
    return {
      available: this.lastError === null,
      connected: this.ipcSocket !== null,
      mode: this.mode,
      lastError: this.lastError,
    };
  }

  setOverlayHost(config: MpvOverlayHostConfig): void {
    this.overlayHostConfig = config;
    this.mode = "overlay-window";
    console.log("[mpv] overlay host configured", config);
  }

  clearOverlayHost(): void {
    this.overlayHostConfig = null;
    if (this.mode === "overlay-window") {
      this.mode = "external-window-mvp";
    }
    console.log("[mpv] overlay host cleared");
  }

  async updateOverlayBounds(bounds: MpvOverlayHostConfig["bounds"]): Promise<void> {
    if (!this.overlayHostConfig) {
      return;
    }

    this.overlayHostConfig = {
      ...this.overlayHostConfig,
      bounds,
    };

    if (!this.ipcSocket) {
      return;
    }

    const geometry = this.formatGeometry(bounds);
    await this.sendCommand({ command: ["set_property", "geometry", geometry] });
  }

  async loadFile(filePath: string): Promise<void> {
    if (!filePath) {
      throw new Error("loadFile requires a non-empty file path");
    }

    console.log("[mpv] loadFile", { filePath });
    await this.sendCommand({ command: ["loadfile", filePath, "replace"] });
  }

  async seek(timeSec: number): Promise<void> {
    if (!Number.isFinite(timeSec)) {
      throw new Error("seek requires a finite time value");
    }

    const safeTime = Math.max(0, timeSec);
    console.log("[mpv] seek", { timeSec: safeTime });
    await this.sendCommand({ command: ["seek", safeTime, "absolute"] });
  }

  async play(): Promise<void> {
    console.log("[mpv] play");
    await this.sendCommand({ command: ["set_property", "pause", false] });
  }

  async pause(): Promise<void> {
    console.log("[mpv] pause");
    await this.sendCommand({ command: ["set_property", "pause", true] });
  }

  async stop(): Promise<void> {
    console.log("[mpv] stop");
    await this.sendCommand({ command: ["stop"] });
  }

  async setVolume(volumePercent: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(volumePercent) ? volumePercent : 100));
    console.log("[mpv] setVolume", { volumePercent: clamped });
    await this.sendCommand({ command: ["set_property", "volume", clamped] });
  }

  async shutdown(): Promise<void> {
    this.connectingPromise = null;

    if (this.ipcSocket) {
      this.ipcSocket.destroy();
      this.ipcSocket = null;
    }

    if (this.mpvProcess) {
      this.mpvProcess.kill();
      this.mpvProcess = null;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.ipcSocket) {
      return;
    }

    if (this.connectingPromise) {
      await this.connectingPromise;
      return;
    }

    this.connectingPromise = this.connectInternal();

    try {
      await this.connectingPromise;
    } finally {
      this.connectingPromise = null;
    }
  }

  private async connectInternal(): Promise<void> {
    if (this.ipcSocket) {
      return;
    }

    if (!this.mpvProcess || this.mpvProcess.exitCode !== null) {
      this.startMpvProcess();
    }

    try {
      await this.connectIpcWithRetry();
    } catch (error) {
      if (this.mode === "overlay-window") {
        console.warn("[mpv] overlay startup failed, falling back to external window", {
          error: error instanceof Error ? error.message : String(error),
        });
        await this.shutdown();
        this.mode = "external-fallback";
        this.startMpvProcess();
        await this.connectIpcWithRetry();
        return;
      }

      throw error;
    }
  }

  private startMpvProcess(): void {
    console.log("[mpv] starting process", {
      mpvBinaryPath: this.mpvBinaryPath,
      ipcPath: this.ipcPath,
    });

    const args = [
      "--no-config",
      "--idle=yes",
      "--force-window=yes",
      "--keep-open=yes",
      `--input-ipc-server=${this.ipcPath}`,
      "--terminal=no",
    ];

    const overlayConfig = this.overlayHostConfig;
    if (process.platform === "win32" && overlayConfig && this.mode !== "external-fallback") {
      const geometry = this.formatGeometry(overlayConfig.bounds);
      // Pseudo-embedded mode: keep mpv as a separate borderless window and
      // continuously pin it to the preview area. This avoids native addons.
      args.push("--border=no");
      args.push("--ontop=yes");
      args.push(`--geometry=${geometry}`);
      this.mode = "overlay-window";
      console.log("[mpv] launching overlay-window", {
        geometry,
      });
    } else if (this.mode !== "external-fallback") {
      this.mode = "external-window-mvp";
      console.log("[mpv] launching external window mode");
    }

    console.log("[mpv] launch args", { args });

    this.mpvProcess = spawn(this.mpvBinaryPath, args, {
      windowsHide: true,
      stdio: "pipe",
    });

    this.mpvProcess.once("spawn", () => {
      this.lastError = null;
      console.log("[mpv] process spawned");
    });

    this.mpvProcess.on("error", (error) => {
      this.lastError = error.message;
      console.error("[mpv] process error", error);
    });

    this.mpvProcess.stderr.on("data", (chunk) => {
      console.warn("[mpv] stderr", chunk.toString().trim());
    });

    this.mpvProcess.stdout.on("data", (chunk) => {
      console.log("[mpv] stdout", chunk.toString().trim());
    });

    this.mpvProcess.on("close", (code, signal) => {
      console.warn("[mpv] process closed", { code, signal });
      this.ipcSocket?.destroy();
      this.ipcSocket = null;
      this.mpvProcess = null;

      if (code !== 0) {
        this.lastError = `mpv process closed unexpectedly (code ${String(code)})`;
      }
    });
  }

  private async connectIpcWithRetry(): Promise<void> {
    const maxAttempts = 80;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const socket = await this.connectIpcOnce();
        this.ipcSocket = socket;
        this.lastError = null;
        console.log("[mpv] ipc connected", { attempt });
        return;
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
        if (attempt === maxAttempts) {
          console.error("[mpv] ipc connection failed", {
            attempts: maxAttempts,
            error: this.lastError,
          });
          throw error;
        }

        await new Promise<void>((resolve) => {
          setTimeout(resolve, 100);
        });
      }
    }
  }

  private connectIpcOnce(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = createConnection(this.ipcPath);

      const onError = (error: Error) => {
        socket.destroy();
        reject(error);
      };

      socket.once("error", onError);
      socket.once("connect", () => {
        socket.removeListener("error", onError);

        socket.on("error", (error) => {
          this.lastError = error.message;
          console.error("[mpv] ipc socket error", error);
          this.ipcSocket = null;
        });

        socket.on("close", () => {
          console.warn("[mpv] ipc socket closed");
          if (this.ipcSocket === socket) {
            this.ipcSocket = null;
          }
        });

        resolve(socket);
      });
    });
  }

  private async sendCommand(payload: MpvCommand): Promise<void> {
    const withId: MpvCommand = {
      ...payload,
      request_id: ++this.requestId,
    };

    try {
      await this.ensureConnected();
      await this.writeCommand(withId);
    } catch (firstError) {
      this.ipcSocket?.destroy();
      this.ipcSocket = null;

      if (!this.mpvProcess || this.mpvProcess.exitCode !== null) {
        this.startMpvProcess();
      }

      await this.ensureConnected();

      try {
        await this.writeCommand(withId);
      } catch (secondError) {
        const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
        const secondMessage = secondError instanceof Error ? secondError.message : String(secondError);
        this.lastError = secondMessage;
        throw new Error(`mpv command failed after retry: ${firstMessage} -> ${secondMessage}`);
      }
    }
  }

  private async writeCommand(command: MpvCommand): Promise<void> {
    if (!this.ipcSocket) {
      throw new Error("mpv IPC socket is not connected");
    }

    await new Promise<void>((resolve, reject) => {
      const commandText = `${JSON.stringify(command)}\n`;
      this.ipcSocket?.write(commandText, (error) => {
        if (error) {
          this.lastError = error.message;
          console.error("[mpv] command write failed", { error: error.message, command });
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  private formatGeometry(bounds: MpvOverlayHostConfig["bounds"]): string {
    return `${Math.max(16, Math.round(bounds.width))}x${Math.max(16, Math.round(bounds.height))}+${Math.max(0, Math.round(bounds.x))}+${Math.max(0, Math.round(bounds.y))}`;
  }

  private resolveMpvBinaryPath(): string {
    const envPath = process.env.AI_VIDEO_EDITOR_MPV_PATH;
    if (envPath && existsSync(envPath)) {
      return envPath;
    }

    if (process.platform === "win32") {
      const windowsCandidates = [
        "D:\\project_tools\\mpv\\mpv.exe",
        "D:\\AI_video_editor_project\\_runtime_cache\\tools\\mpv\\mpv.exe",
        "C:\\Program Files\\MPV Player\\mpv.exe",
      ];

      for (const candidate of windowsCandidates) {
        if (existsSync(candidate)) {
          console.log("[mpv] using discovered executable", { candidate });
          return candidate;
        }
      }
    }

    return "mpv";
  }
}
