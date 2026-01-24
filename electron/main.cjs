const { app, BrowserWindow, dialog, session, ipcMain, net } = require('electron');

// Disable Autofill and Password Manager to prevent console errors and interference
app.commandLine.appendSwitch('disable-features', 'Autofill,PasswordManager');
app.commandLine.appendSwitch('disable-save-password-bubble');

const proxyAuthMap = new Map();

// ...

app.on('login', (event, webContents, request, authInfo, callback) => {
  const logMsg = `Login event: isProxy=${authInfo.isProxy} scheme=${authInfo.scheme} host=${authInfo.host} port=${authInfo.port} realm=${authInfo.realm}`;
  logToFile(logMsg);
  console.log(logMsg); // Show in terminal for debugging

  if (authInfo.isProxy) {
    const key = `${authInfo.host}:${authInfo.port}`;
    logToFile(`Looking for credentials for ${key}`);

    let creds = proxyAuthMap.get(key);

    // Fallback: If exact match fails, try matching by PORT (assuming unique ports for rotating proxies)
    if (!creds) {
      logToFile(`Exact match failed for ${key}. Checking by port ${authInfo.port}...`);
      for (const [mapKey, mapCreds] of proxyAuthMap.entries()) {
        if (mapKey.endsWith(`:${authInfo.port}`)) {
          logToFile(`Found credentials by port match: ${mapKey}`);
          creds = mapCreds;
          break;
        }
      }
    }

    if (creds) {
      logToFile(`Authenticating... (User: ${creds.username})`);
      event.preventDefault();
      callback(creds.username, creds.password);
    } else {
      logToFile(`No credentials found for ${key}`);
      console.log(`[ProxyAuth] Failed to find credentials for ${key}`);
    }
  }
});

// ...

ipcMain.on('set-proxy', async (event, { partition, proxyRules }) => {
  // Remove trailing slash from proxy URL if present
  const cleanProxyRules = proxyRules.replace(/\/$/, '');
  logToFile(`Setting proxy for partition ${partition} to ${cleanProxyRules}`);

  try {
    let finalProxy = cleanProxyRules;
    const match = cleanProxyRules.match(/^(?:https?:\/\/)?([^:]+):([^@]+)@(.+)$/);

    if (match) {
      const username = match[1];
      const password = match[2];
      let hostAndPort = match[3];

      // Remove trailing slash if present
      if (hostAndPort.endsWith('/')) {
        hostAndPort = hostAndPort.slice(0, -1);
      }

      logToFile(`Parsed credentials - User: ${username}, Host: ${hostAndPort}`);

      const hasProtocol = cleanProxyRules.includes('://');
      const protocol = hasProtocol ? cleanProxyRules.split('://')[0] + '://' : '';
      finalProxy = `${protocol}${hostAndPort}`;

      proxyAuthMap.set(hostAndPort, { username, password });
    } else {
      logToFile(`No credentials matched in ${cleanProxyRules}`);
    }

    const ses = session.fromPartition(partition);
    await ses.setProxy({ proxyRules: finalProxy });
    logToFile(`Proxy set successfully for ${partition} (Sanitized: ${finalProxy})`);
    event.sender.send('proxy-set-complete', { partition }); // Ack
  } catch (e) {
    logToFile(`Error setting proxy: ${e.message}`);
  }
});

ipcMain.on('get-ip-info', (event, { partition }) => {
  const msg = `[IPCheck] Checking IP for partition ${partition}`;
  logToFile(msg);
  console.log(msg);

  const ses = session.fromPartition(partition);
  const req = net.request({
    url: 'https://api.ipify.org',
    session: ses,
    useSessionCookies: true
  });

  // Set a timeout for the request (e.g., 10 seconds)
  const timeout = setTimeout(() => {
    if (req) {
      req.abort();
      const timeoutMsg = `[IPCheck] Timed Out for ${partition}`;
      logToFile(timeoutMsg);
      console.log(timeoutMsg);
      event.sender.send('ip-info-result', { partition, error: 'Timeout' });
    }
  }, 10000);

  req.on('response', (response) => {
    clearTimeout(timeout);
    console.log(`[IPCheck] Response received, status: ${response.statusCode}`);
    let data = '';
    response.on('data', (chunk) => { data += chunk; });
    response.on('end', () => {
      const successMsg = `[IPCheck] IP Found: ${data}`;
      logToFile(successMsg);
      console.log(successMsg);
      event.sender.send('ip-info-result', { partition, ip: data });
    });
  });

  req.on('error', (err) => {
    clearTimeout(timeout);
    const errMsg = `[IPCheck] Failed: ${err.message}`;
    logToFile(errMsg);
    console.log(errMsg);
    event.sender.send('ip-info-result', { partition, error: err.message });
  });

  req.end();
  console.log(`[IPCheck] Request sent for ${partition}`);
});
const path = require('path');
const { spawn } = require('child_process');
const isDev = !app.isPackaged;
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
      // Native .env loading for Node 20+
      backendProcess = spawn(process.execPath, ['--env-file=.env', serverPath], {
        cwd: backendPath,
        env: {
          ...process.env,
          PORT: BACKEND_PORT,
          NODE_ENV: 'production',
          PLAYWRIGHT_BROWSERS_PATH: browsersPath,
          ELECTRON_RUN_AS_NODE: '1'
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

  // Intercept window.open / target="_blank" from webviews and send back to renderer
  // This prevents opening new Electron windows and instead signals renderer to create new tab
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    logToFile(`[WindowOpen] Intercepted window.open for URL: ${url}`);
    console.log(`[WindowOpen] Intercepted: ${url}`);

    // Send URL to renderer to open as new tab in InAppBrowser
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('open-url-in-tab', { url });
    }

    // Deny opening new window - renderer will handle it
    return { action: 'deny' };
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



// Handle ALL new window requests from webviews - redirect to renderer as new tabs
// This intercepts target="_blank" links and window.open() calls from webview content
app.on('web-contents-created', (event, contents) => {
  // Only handle webview guest contents
  if (contents.getType() === 'webview') {
    // Modern Electron: use setWindowOpenHandler on webview contents
    contents.setWindowOpenHandler(({ url }) => {
      logToFile(`[Webview] Intercepted new window request: ${url}`);
      console.log(`[Webview] Intercepted popup: ${url}`);

      // Send URL to renderer to open as new tab
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('open-url-in-tab', { url });
      }

      // Deny opening new window - renderer will handle it as new tab
      return { action: 'deny' };
    });

    // Also handle navigation events for webviews
    contents.on('will-navigate', (event, url) => {
      logToFile(`[Webview] Navigation to: ${url}`);
    });
  }
});

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
