/// <reference types="vite/client" />

type RpcStatusPayload = {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  message: string;
};

type ImageUploadResult =
  | { ok: true; url: string; fileName: string }
  | { ok: false; canceled: true }
  | { ok: false; error: string };

type VideoUploadResult =
  | { ok: true; url: string; fileName?: string }
  | { ok: false; canceled: true }
  | { ok: false; error: string };

type ImageResolveResult =
  | { ok: true; url: string; changed: boolean }
  | { ok: false; error: string };

type ImageFetchDataUrlResult =
  | { ok: true; dataUrl: string; mime: string; animated: boolean }
  | { ok: false; error: string };

declare global {
  interface Window {
    myPresenceDesktop?: {
      getMeta: () => Promise<{
        platform: string;
        darkMode: boolean;
        version: string;
      }>;
      setLaunchOnStartup: (enabled: boolean) => Promise<{ ok: boolean }>;
      getLaunchOnStartup: () => Promise<boolean>;
      connect: (applicationId: string) => Promise<{ ok: boolean }>;
      setActivity: (activity: unknown) => Promise<{ ok: boolean }>;
      clear: () => Promise<{ ok: boolean }>;
      disconnect: () => Promise<{ ok: boolean }>;
      uploadImage: () => Promise<ImageUploadResult>;
      uploadVideo: () => Promise<VideoUploadResult>;
      resolveImageUrl: (url: string) => Promise<ImageResolveResult>;
      fetchImageAsDataUrl: (url: string) => Promise<ImageFetchDataUrlResult>;
      uploadImageBytes: (base64: string, mime: string) => Promise<ImageUploadResult>;
      onStatus: (callback: (payload: RpcStatusPayload) => void) => () => void;
      // New enhanced app control
      hideWindow: () => Promise<void>;
      showWindow: () => Promise<void>;
      minimizeToTray: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      isWindowVisible: () => Promise<boolean>;
      onTrayAction: (callback: (action: string) => void) => () => void;
      getDefaultBackgroundPath: () => Promise<string>;
    };
  }
}

export {};
