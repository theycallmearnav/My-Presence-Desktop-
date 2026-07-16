import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, protocol, shell, Tray } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { discordRpcClient, type DiscordActivity } from './discordRpc';
import { pickAndUploadImage, resolveImageUrl, fetchImageAsDataUrl, uploadBytes } from './imageUpload';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function getDefaultBackgroundPath(): string {
  if (isDev) {
    return path.join(app.getAppPath(), 'public', 'assets', 'backgrounds', 'default.mp4');
  }
  return path.join(app.getAppPath(), 'assets', 'backgrounds', 'default.mp4');
}

function ensureBackgroundsDir(): string {
  const dir = path.join(app.getPath('userData'), 'backgrounds');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function copyFileToBackgrounds(filePath: string): string {
  const dir = ensureBackgroundsDir();
  const ext = path.extname(filePath);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const destPath = path.join(dir, fileName);
  fs.copyFileSync(filePath, destPath);
  return destPath;
}

const startHidden =
  process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAtLogin;

function loadTrayIcon() {
  try {
    return nativeImage.createFromPath(path.join(app.getAppPath(), 'ic_app_logo.png'));
  } catch {
    // Fallback to a minimal transparent icon
    return nativeImage.createEmpty();
  }
}

function showMainWindow() {
  if (!mainWindow) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function sendTrayAction(action: string) {
  mainWindow?.webContents.send('tray:action', action);
}

function createTray() {
  if (tray) return;
  tray = new Tray(loadTrayIcon());
  tray.setToolTip('MY PRESENCE');

  const menu = Menu.buildFromTemplate([
    { label: 'Show My Presence', click: () => showMainWindow() },
    { type: 'separator' },
    { label: 'Go Live', click: () => sendTrayAction('go-live') },
    { label: 'Pause Presence', click: () => sendTrayAction('pause') },
    { label: 'Reconnect', click: () => sendTrayAction('reconnect') },
    { type: 'separator' },
    { label: 'Themes', click: () => { showMainWindow(); sendTrayAction('themes'); } },
    { label: 'Settings', click: () => { showMainWindow(); sendTrayAction('settings'); } },
    { type: 'separator' },
    { label: 'Exit', click: () => { isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => showMainWindow());
  tray.on('click', () => showMainWindow());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 980,
    minWidth: 1240,
    minHeight: 780,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    backgroundColor: '#1e1f22',
    icon: path.join(app.getAppPath(), 'ic_app_logo.png'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const url = isDev ? 'http://127.0.0.1:5173' : `file://${path.join(app.getAppPath(), 'dist', 'index.html')}`;
  mainWindow.loadURL(url);

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//i.test(target)) { void shell.openExternal(target); }
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    if (!startHidden) mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { showMainWindow(); });

  app.whenReady().then(() => {
    // Register custom protocol for local video files
    protocol.registerFileProtocol('local-video', (request, callback) => {
      const fileName = request.url.replace('local-video://', '');
      const filePath = path.join(ensureBackgroundsDir(), fileName);
      if (fs.existsSync(filePath)) {
        callback({ path: filePath });
      } else {
        callback({ error: -6 }); // FILE_NOT_FOUND
      }
    });

    // Remove native menu bar entirely
    Menu.setApplicationMenu(null);

    discordRpcClient.onStatus((payload) => {
      mainWindow?.webContents.send('rpc:status', payload);
    });

    createTray();
    createWindow();

    // Auto-open DevTools in development
    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: 'bottom' });
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showMainWindow();
    });
  });
}

app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  isQuitting = true;
  discordRpcClient.disconnect();
});

// Enhanced IPC handlers
ipcMain.handle('app:get-meta', () => ({
  platform: process.platform,
  darkMode: nativeTheme.shouldUseDarkColors,
  version: app.getVersion()
}));

ipcMain.handle('app:set-login-item', (_event, enabled: boolean) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled), openAsHidden: true, args: ['--hidden'] });
  return { ok: true };
});

ipcMain.handle('app:get-login-item', () => app.getLoginItemSettings().openAtLogin);

ipcMain.handle('app:hide', () => { mainWindow?.hide(); });
ipcMain.handle('app:show', () => { showMainWindow(); });
ipcMain.handle('app:minimize-to-tray', () => { mainWindow?.hide(); });
ipcMain.handle('app:is-visible', () => mainWindow?.isVisible() ?? false);
ipcMain.handle('app:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

ipcMain.handle('rpc:connect', async (_event, applicationId: string) => {
  await discordRpcClient.connect(applicationId);
  return { ok: true };
});

ipcMain.handle('rpc:set-activity', async (_event, activity: DiscordActivity) => {
  await discordRpcClient.setActivity(activity);
  return { ok: true };
});

ipcMain.handle('rpc:clear', async () => {
  await discordRpcClient.clearActivity();
  return { ok: true };
});

ipcMain.handle('rpc:disconnect', async () => {
  discordRpcClient.disconnect();
  return { ok: true };
});

ipcMain.handle('image:upload', async () => {
  return pickAndUploadImage(mainWindow);
});

ipcMain.handle('video:upload', async () => {
  const selection = await dialog.showOpenDialog(mainWindow!, {
    title: 'Choose a video',
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'webm', 'mov'] }]
  });
  if (selection.canceled || selection.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }
  const filePath = selection.filePaths[0];
  const destPath = copyFileToBackgrounds(filePath);
  // Return a custom protocol URL that our renderer can use
  return { ok: true, url: `local-video://${path.basename(destPath)}` };
});

ipcMain.handle('image:resolve', async (_event, url: string) => {
  return resolveImageUrl(url);
});

ipcMain.handle('image:fetch-data-url', async (_event, url: string) => {
  return fetchImageAsDataUrl(url);
});

ipcMain.handle('image:upload-bytes', async (_event, payload: { base64: string; mime: string }) => {
  return uploadBytes(payload.base64, payload.mime);
});

ipcMain.handle('bg:get-default-path', () => {
  return getDefaultBackgroundPath();
});
