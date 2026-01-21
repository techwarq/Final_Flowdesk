const { app, BrowserWindow, dialog, session, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = require('electron-is-dev');
const waitOn = require('wait-on');
const fs = require('fs');

// Simple file logger for startup debugging
const logPath = path.join(app.getPath('home'), 'astra_startup_log.txt');

function logToFile(msg) {
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `${timestamp}: ${msg}\n`);
  } catch (e) {
    // ignore logging errors
  }
}

// Global exception handlers
process.on('uncaughtException', (error) => {
  logToFile(`UNCAUGHT EXCEPTION: ${error.stack || error}`);
  dialog.showErrorBox('Startup Error', `An error occurred: ${error.message}\nCheck ${logPath} for details.`);
  process.exit(1);
});

logToFile('App starting...');
try {
  logToFile(`App path: ${app.getAppPath()}`);
  logToFile(`Resources path: ${process.resourcesPath}`);
} catch (e) { }

let mainWindow;
let splashWindow;
let backendProcess;

// Backend setup
const BACKEND_PORT = 3001;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

function startBackend() {
  logToFile('Starting backend function called');
  if (isDev) {
    logToFile('Mode: Development');
    console.log('Starting backend in DEV mode...');
    // In dev, we spawn npm run start which uses tsx
    const backendPath = path.join(__dirname, '..', 'backend');

    backendProcess = spawn('npm', ['run', 'start'], {
      cwd: backendPath,
      env: { ...process.env, PORT: BACKEND_PORT },
      shell: true,
      stdio: 'inherit'
    });
  } else {
    logToFile('Mode: Production');
    console.log('Starting backend in PROD mode...');
    const backendPath = path.join(process.resourcesPath, 'backend');
    logToFile(`Backend Path: ${backendPath}`);
    // Ensure we point to the compiled server file
    const serverPath = path.join(backendPath, 'dist', 'server.js');
    logToFile(`Server Path: ${serverPath}`);

    // Path where browsers are bundled
    const browsersPath = path.join(backendPath, 'browsers');
    logToFile(`Browsers Path: ${browsersPath}`);

    try {
      if (!fs.existsSync(serverPath)) {
        logToFile(`ERROR: Server file not found at ${serverPath}`);
        dialog.showErrorBox('Startup Error', `Backend server file missing at ${serverPath}\nThis is a build issue.`);
      }

      // Use pipe specifically to capture logs
      backendProcess = spawn(process.execPath, [serverPath], {
        cwd: backendPath,
        env: {
          ...process.env,
          PORT: BACKEND_PORT,
          NODE_ENV: 'production',
          PLAYWRIGHT_BROWSERS_PATH: browsersPath
        },
        stdio: 'pipe'
      });

      if (backendProcess && backendProcess.stdout) {
        backendProcess.stdout.on('data', (data) => {
          logToFile(`[Backend]: ${data}`);
        });
      }
      if (backendProcess && backendProcess.stderr) {
        backendProcess.stderr.on('data', (data) => {
          logToFile(`[Backend ERROR]: ${data}`);
        });
      }

      logToFile(`Backend spawned with PID: ${backendProcess.pid}`);
    } catch (e) {
      logToFile(`Failed to spawn backend: ${e.message}`);
      dialog.showErrorBox('Startup Error', `Failed to spawn backend: ${e.message}`);
    }
  }

  if (backendProcess) {
    backendProcess.on('error', (err) => {
      logToFile(`Backend process error: ${err.message}`);
      console.error('Failed to start backend:', err);
    });

    backendProcess.on('exit', (code, signal) => {
      logToFile(`Backend process exited with code ${code} and signal ${signal}`);
      console.log(`Backend process exited with code ${code} and signal ${signal}`);
    });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Don't show until ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
  });

  const frontendUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '..', 'dist', 'index.html')}`;

  logToFile(`Loading frontend from: ${frontendUrl}`);
  console.log(`Loading frontend from: ${frontendUrl}`);

  // Resources to wait for
  const resources = [`tcp:${BACKEND_PORT}`];
  if (isDev) {
    resources.push('tcp:5173');
  }

  // Waiting for services
  waitOn({
    resources: resources,
    timeout: 30000 // 30s
  }).then(() => {
    logToFile('Services are ready!');
    console.log('Services are ready!');
    mainWindow.loadURL(frontendUrl);

    // NO-OP here, we wait for IPC 'app-ready' from React
  }).catch((err) => {
    logToFile(`Services did not start in time: ${err.message}`);
    console.error('Services did not start in time:', err);
    mainWindow.loadURL(frontendUrl);
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();

    // Pipe renderer console logs to terminal
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[Renderer]: ${message}`);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}



function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 340,
    height: 340,
    titleBarStyle: 'hidden',
    frame: false,
    alwaysOnTop: true,
    transparent: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
}

app.on('ready', () => {
  logToFile('Electron Ready event fired');
  createSplashWindow();
  startBackend();
  createWindow();

  ipcMain.on('app-ready', () => {
    logToFile('App ready event received from renderer');
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
    if (splashWindow) {
      setTimeout(() => {
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.destroy();
          splashWindow = null;
        }
      }, 300); // Small buffer to ensure smooth transition
    }
    ipcMain.on('set-proxy', async (event, { partition, proxyRules }) => {
      logToFile(`Setting proxy for partition ${partition} to ${proxyRules}`);
      const ses = session.fromPartition(partition);
      await ses.setProxy({ proxyRules });
      logToFile(`Proxy set successfully for ${partition}`);
    });

    ipcMain.on('get-ip-info', async (event, { partition }) => {
      // This is a helper to verify IP from the main process side if needed, 
      // but we can also just do it in the renderer via fetch() if proxy is set correctly.
      // For now we just ack.
    });

    ipcMain.on('set-cookies', async (event, { partition, cookies }) => {
      // logToFile(`Setting ${cookies.length} cookies for partition ${partition}`);
      if (!cookies || !Array.isArray(cookies)) return;

      const ses = session.fromPartition(partition);

      for (const cookie of cookies) {
        try {
          // Electron requires URL for setting cookies usually
          let url = '';
          if (cookie.url) {
            url = cookie.url;
          } else if (cookie.domain) {
            // Remove leading dot
            const cleanDomain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
            url = (cookie.secure ? 'https://' : 'http://') + cleanDomain;
          }

          const details = {
            url: url,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expires || cookie.expirationDate,
            sameSite: cookie.sameSite === 'None' ? 'no_restriction' : cookie.sameSite === 'Lax' ? 'lax' : 'strict'
          };

          // Fix SameSite for Electron (no_restriction must be used with secure)
          if (details.sameSite === 'no_restriction' && !details.secure) {
            details.sameSite = 'unspecified';
          }

          await ses.cookies.set(details);
        } catch (e) {
          // logToFile(`Failed to set cookie ${cookie.name}: ${e.message}`);
        }
      }
      // logToFile(`Cookies set for ${partition}`);
      event.sender.send('cookies-set', { partition, success: true });
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
