const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const chatUrl =
  process.env.OPS_DESKTOP_CHAT_URL || 'https://rs.pttads.vn/crm/csd/chat?shell=desktop';

let win = null;
let tray = null;
let quitting = false;

function chatDir() {
  const dir = path.join(os.homedir(), 'RNOSAI', 'CSD-Chat');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isInsideChatDir(filePath) {
  if (typeof filePath !== 'string' || !filePath) return false;
  const root = path.resolve(chatDir());
  const target = path.resolve(filePath);
  const rel = path.relative(root, target);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function trayImage() {
  const iconPath = path.join(__dirname, 'icon.png');
  if (fs.existsSync(iconPath)) {
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) return image.resize({ width: 16, height: 16 });
  }
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAHElEQVQ4T2NkoBAwUqifgYGB4T8DAwMDw38GBob/DAAAAAD//2k1C0cAAAAASUVORK5CYII=',
  );
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Chat SD',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadURL(chatUrl);
  win.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
  });
}

ipcMain.on('chat-sd-focus', () => {
  if (!win) return;
  win.show();
  win.focus();
});

ipcMain.on('chat-sd-unread', (_event, count) => {
  const n = Number(count);
  if (!tray || !Number.isFinite(n)) return;
  tray.setToolTip(n > 0 ? `Chat SD · ${n} chưa đọc` : 'Chat SD');
});

ipcMain.handle('chat-sd-open-file', async (_event, filePath) => {
  if (!isInsideChatDir(filePath)) return false;
  const err = await shell.openPath(filePath);
  return err === '';
});

ipcMain.handle('chat-sd-reveal', async (_event, filePath) => {
  if (!isInsideChatDir(filePath)) return false;
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle('chat-sd-save', async (_event, bytes, fileName, fileId) => {
  const safe = path.basename(String(fileName || 'file'));
  const dest = path.join(chatDir(), safe);
  fs.writeFileSync(dest, Buffer.from(bytes));
  if (fileId) {
    fs.writeFileSync(path.join(chatDir(), `${String(fileId)}.path`), dest);
  }
  return dest;
});

ipcMain.handle('chat-sd-has', async (_event, fileId) => {
  const marker = path.join(chatDir(), `${String(fileId)}.path`);
  if (!fs.existsSync(marker)) return null;
  const target = fs.readFileSync(marker, 'utf8').trim();
  return isInsideChatDir(target) && fs.existsSync(target) ? target : null;
});

app.whenReady().then(() => {
  createWindow();
  tray = new Tray(trayImage());
  tray.setToolTip('Chat SD');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Mở Chat SD',
        click: () => {
          win.show();
          win.focus();
        },
      },
      {
        label: 'Thoát',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('click', () => {
    win.show();
    win.focus();
  });

  const feed = process.env.OPS_DESKTOP_UPDATE_URL;
  if (feed) {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.setFeedURL({ provider: 'generic', url: feed });
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('window-all-closed', () => {
  if (quitting) app.quit();
});
