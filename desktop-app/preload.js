const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopShell", {
  isElectron: true,
  openPdfFile(payload) {
    return ipcRenderer.invoke("desktop-shell:open-pdf", payload);
  },
  printPdfFile(payload) {
    return ipcRenderer.invoke("desktop-shell:print-pdf", payload);
  },
});

window.addEventListener("DOMContentLoaded", () => {
  document.documentElement.dataset.desktopShell = "electron";
});
