// 暴露给网页的少量原生能力（与 Mac 客户端的 messageHandler 对应）
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lawdeskNative', {
  platform: process.platform,
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  restart: () => ipcRenderer.invoke('restart'),
});
