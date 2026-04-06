export {};

declare global {
  interface Window {
    desktopAPI: {
      openMediaFile: () => Promise<string | null>;
    };
  }
}
