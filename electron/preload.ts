import { contextBridge, ipcRenderer } from 'electron';

type RpcStatusPayload = {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  message: string;
};

type UploadResult =
  | { ok: true; url: string; fileName: string }
  | { ok: false; canceled: true }
  | { ok: false; error: string };

type VideoUploadResult =
  | { ok: true; url: string; fileName: string }
  | { ok: false; canceled: true }
  | { ok: false; error: string };

type ResolveResult =
  | { ok: true; url: string; changed: boolean }
  | { ok: false; error: string };

type FetchDataUrlResult =
  | { ok: true; dataUrl: string; mime: string; animated: boolean }
  | { ok: false; error: string };

contextBridge.exposeInMainWorld('myPresenceDesktop', {
  getMeta: () => ipcRenderer.invoke('app:get-meta'),
  setLaunchOnStartup: (enabled: boolean): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('app:set-login-item', enabled),
  getLaunchOnStartup: (): Promise<boolean> => ipcRenderer.invoke('app:get-login-item'),
  connect: (applicationId: string) => ipcRenderer.invoke('rpc:connect', applicationId),
  setActivity: (activity: unknown) => ipcRenderer.invoke('rpc:set-activity', activity),
  clear: () => ipcRenderer.invoke('rpc:clear'),
  disconnect: () => ipcRenderer.invoke('rpc:disconnect'),
  uploadImage: (): Promise<UploadResult> => ipcRenderer.invoke('image:upload'),
  uploadVideo: (): Promise<VideoUploadResult> => ipcRenderer.invoke('video:upload'),
  resolveImageUrl: (url: string): Promise<ResolveResult> => ipcRenderer.invoke('image:resolve', url),
  fetchImageAsDataUrl: (url: string): Promise<FetchDataUrlResult> => ipcRenderer.invoke('image:fetch-data-url', url),
  uploadImageBytes: (base64: string, mime: string): Promise<UploadResult> =>
    ipcRenderer.invoke('image:upload-bytes', { base64, mime }),
  onStatus: (callback: (payload: RpcStatusPayload) => void) => {
    const handler = (_event: unknown, payload: RpcStatusPayload) => callback(payload);
    ipcRenderer.on('rpc:status', handler);
    return () => ipcRenderer.removeListener('rpc:status', handler);
  },
  // Enhanced app control
  hideWindow: () => ipcRenderer.invoke('app:hide'),
  showWindow: () => ipcRenderer.invoke('app:show'),
  minimizeToTray: () => ipcRenderer.invoke('app:minimize-to-tray'),
  maximizeWindow: () => ipcRenderer.invoke('app:maximize'),
  isWindowVisible: (): Promise<boolean> => ipcRenderer.invoke('app:is-visible'),
  onTrayAction: (callback: (action: string) => void) => {
    const handler = (_event: unknown, action: string) => callback(action);
    ipcRenderer.on('tray:action', handler);
    return () => ipcRenderer.removeListener('tray:action', handler);
  },
  getDefaultBackgroundPath: (): Promise<string> => ipcRenderer.invoke('bg:get-default-path'),
});
