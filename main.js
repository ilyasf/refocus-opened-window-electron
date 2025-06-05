const { app, BrowserWindow, ipcMain, BrowserView, Notification } = require("electron");

let mainWindow;
// Keep track of window references to handle force close
let killableWindows = new Map();

function showCrashNotification(windowTitle) {
  new Notification({
    title: 'Window Crashed',
    body: `Window "${windowTitle}" crashed`
  }).show();
}

function forceCloseWindow(window, views) {
  try {
    // Remove browser views first
    if (views) {
      views.forEach((view) => {
        if (view) {
          try {
            window.removeBrowserView(view);
          } catch (viewError) {
            console.error("Error removing browser view:", viewError);
          }
        }
      });
    }
    // Force destroy the window
    if (window && !window.isDestroyed()) {
      window.destroy();
    }
  } catch (error) {
    console.error("Error forcing window close:", error);
  }
}

app.on("ready", () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile("index.html");

  ipcMain.on("open-killing-window", () => {
    const newWindow = new BrowserWindow({
      width: 800,
      height: 600,
      frame: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    // Create titlebar view
    const titlebarView = new BrowserView({
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    // Create content view
    const contentView = new BrowserView({
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    // Store references for force close
    const views = [titlebarView, contentView];
    killableWindows.set(newWindow.id, { window: newWindow, views });

    newWindow.addBrowserView(titlebarView);
    newWindow.addBrowserView(contentView);
    
    titlebarView.setBounds({ x: 0, y: 0, width: 800, height: 32 });    
    contentView.setBounds({ x: 0, y: 32, width: 800, height: 568 });

    
    titlebarView.webContents.loadFile("titlebar.html");
    contentView.webContents.loadFile("test-killing.html");   

    contentView.webContents.on("render-process-gone", () => {
      const windowData = killableWindows.get(newWindow.id);
      if (windowData) {
        showCrashNotification("Test killing browser window");
        forceCloseWindow(windowData.window, windowData.views);
      }
    });

    contentView.webContents.on("unresponsive", () => {
      const windowData = killableWindows.get(newWindow.id);
      if (windowData) {
        showCrashNotification("Test killing browser window");
        forceCloseWindow(windowData.window, windowData.views);
      }
    });

    // Handle window resize
    newWindow.on("resize", () => {
      const bounds = newWindow.getBounds();
      titlebarView.setBounds({ x: 0, y: 0, width: bounds.width, height: 32 });
      contentView.setBounds({
        x: 0,
        y: 32,
        width: bounds.width,
        height: bounds.height - 32,
      });
    });
    
    ipcMain.on("minimize-window", () => {
      if (!newWindow.isDestroyed()) {
        newWindow.minimize();
      }
    });

    ipcMain.on("maximize-window", () => {
      if (!newWindow.isDestroyed()) {
        if (newWindow.isMaximized()) {
          newWindow.unmaximize();
        } else {
          newWindow.maximize();
        }
      }
    });

    ipcMain.on("close-window", () => {
      const windowData = killableWindows.get(newWindow.id);
      if (windowData) {
        forceCloseWindow(windowData.window, windowData.views);
      } else if (!newWindow.isDestroyed()) {
        newWindow.close();
      }
    });

    // Clean up when window is closed
    newWindow.on("closed", () => {
      killableWindows.delete(newWindow.id);
      ipcMain.removeListener("minimize-window", () => {});
      ipcMain.removeListener("maximize-window", () => {});
      ipcMain.removeListener("close-window", () => {});
    });
  });
});
