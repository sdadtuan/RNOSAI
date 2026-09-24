const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rnosDesktop', {
  shell: 'desktop',
  focus() {
    ipcRenderer.send('chat-sd-focus');
  },
  setUnread(count) {
    ipcRenderer.send('chat-sd-unread', count);
  },
  openFile: (filePath) => ipcRenderer.invoke('chat-sd-open-file', filePath),
  revealInFolder: (filePath) => ipcRenderer.invoke('chat-sd-reveal', filePath),
  saveFile: (bytes, fileName, fileId) => ipcRenderer.invoke('chat-sd-save', bytes, fileName, fileId),
  hasLocalFile: (fileId) => ipcRenderer.invoke('chat-sd-has', fileId),
});
