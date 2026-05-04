const fs = require("fs");
const http = require("http");
const path = require("path");
const net = require("net");
const { spawn, spawnSync } = require("child_process");
const { app, BrowserWindow, Menu, dialog, shell } = require("electron");

const PRODUCT_NAME = "Material de Construção Dois Irmãos";
const APP_ID = "com.doisirmaos.desktop";
const FLASK_HOST = "127.0.0.1";
const FLASK_PORT = 8000;
const BASE_URL = `http://${FLASK_HOST}:${FLASK_PORT}/`;
const HEALTHCHECK_PATH = "/api/health";
const STARTUP_TIMEOUT_MS = 30000;
const HEALTHCHECK_INTERVAL_MS = 500;
const DEFAULT_BACKGROUND = "#F8FAFC";

app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");

let mainWindow = null;
let flaskProcess = null;
let flaskOwnedByElectron = false;
let quittingAfterCleanup = false;
let cleanupCompleted = false;

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}

function getProjectRoot() {
  return path.resolve(__dirname, "..");
}

function getServerRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, "server") : getProjectRoot();
}

function getBundledRuntimeRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "runtime")
    : path.join(__dirname, "runtime");
}

function getIconPath() {
  return path.join(__dirname, "assets", "app-icon.ico");
}

function getLogPaths() {
  const logDir = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(logDir, { recursive: true });
  return {
    stdout: path.join(logDir, "flask-stdout.log"),
    stderr: path.join(logDir, "flask-stderr.log"),
  };
}

function appendLogLine(filePath, chunk) {
  try {
    fs.appendFileSync(filePath, chunk);
  } catch (_error) {
    // O app desktop deve continuar mesmo se o log falhar.
  }
}

function toForwardSlash(targetPath) {
  return String(targetPath || "").replace(/\\/g, "/");
}

function getPackagedEnvPath() {
  const userEnvPath = path.join(app.getPath("userData"), ".env");
  if (fs.existsSync(userEnvPath)) {
    return userEnvPath;
  }

  const bundledDefaultEnv = path.join(getBundledRuntimeRoot(), "default-env", ".env");
  if (fs.existsSync(bundledDefaultEnv)) {
    fs.mkdirSync(path.dirname(userEnvPath), { recursive: true });
    fs.copyFileSync(bundledDefaultEnv, userEnvPath);
    return userEnvPath;
  }

  return userEnvPath;
}

function getEnvironmentFilePath() {
  if (app.isPackaged) {
    return getPackagedEnvPath();
  }

  const localEnv = path.join(getProjectRoot(), ".env");
  return fs.existsSync(localEnv) ? localEnv : path.join(getProjectRoot(), ".env.example");
}

function getStorageDirectory() {
  return app.isPackaged
    ? path.join(app.getPath("userData"), "storage")
    : path.join(getProjectRoot(), "storage");
}

function resolvePythonExecutable() {
  const runtimeRoot = getBundledRuntimeRoot();
  const localRuntime = path.join(runtimeRoot, "python", "python.exe");
  const customExecutable = process.env.DESKTOP_APP_PYTHON;
  const customHome = process.env.DESKTOP_APP_PYTHON_HOME
    ? path.join(process.env.DESKTOP_APP_PYTHON_HOME, "python.exe")
    : "";
  const codexRuntime = path.join(
    process.env.USERPROFILE || app.getPath("home"),
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "python",
    "python.exe",
  );

  const candidates = [customExecutable, customHome, localRuntime, codexRuntime].filter(Boolean);
  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  return resolved || "python";
}

function buildPythonPath() {
  const serverRoot = getServerRoot();
  const sitePackages = path.join(serverRoot, ".runtime-packages");
  const entries = [serverRoot, sitePackages];

  if (process.env.PYTHONPATH) {
    entries.push(process.env.PYTHONPATH);
  }

  return entries
    .filter(Boolean)
    .join(path.delimiter);
}

function requestHealthcheck() {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: FLASK_HOST,
        port: FLASK_PORT,
        path: HEALTHCHECK_PATH,
        timeout: 1000,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve(response.statusCode === 200 && body.includes('"status":"ok"'));
        });
      },
    );

    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function checkPortInUse() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: FLASK_HOST, port: FLASK_PORT });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

function getStartupErrorMessage(baseMessage) {
  const logPaths = getLogPaths();
  return [
    baseMessage,
    "",
    `Porta monitorada: ${FLASK_PORT}`,
    `Healthcheck: ${BASE_URL}api/health`,
    `Logs: ${logPaths.stderr}`,
  ].join("\n");
}

function showFatalError(message) {
  dialog.showErrorBox("Erro ao abrir o aplicativo", message);
}

async function ensurePortReadyForElectron() {
  if (await requestHealthcheck()) {
    return { reusedExistingServer: true };
  }

  if (await checkPortInUse()) {
    throw new Error(
      [
        `A porta ${FLASK_PORT} já está em uso por outro processo.`,
        "Feche a outra aplicação que usa essa porta ou libere o endereço antes de abrir o desktop app.",
      ].join("\n\n"),
    );
  }

  return { reusedExistingServer: false };
}

function attachProcessLogging(child) {
  const logPaths = getLogPaths();

  if (child.stdout) {
    child.stdout.on("data", (chunk) => {
      appendLogLine(logPaths.stdout, chunk);
    });
  }

  if (child.stderr) {
    child.stderr.on("data", (chunk) => {
      appendLogLine(logPaths.stderr, chunk);
    });
  }
}

function spawnFlaskServer() {
  const pythonExecutable = resolvePythonExecutable();
  const serverRoot = getServerRoot();
  const appScript = path.join(serverRoot, "app.py");

  if (!fs.existsSync(appScript)) {
    throw new Error(`Arquivo do servidor Flask não encontrado em:\n${appScript}`);
  }

  const env = {
    ...process.env,
    PORT: String(FLASK_PORT),
    FLASK_DEBUG: "0",
    PYTHONUNBUFFERED: "1",
    PYTHONIOENCODING: "utf-8",
    PYTHONPATH: buildPythonPath(),
    DOISIRMAOS_ENV_FILE: getEnvironmentFilePath(),
    DOISIRMAOS_STORAGE_DIR: getStorageDirectory(),
  };

  fs.mkdirSync(env.DOISIRMAOS_STORAGE_DIR, { recursive: true });

  const child = spawn(pythonExecutable, [appScript], {
    cwd: serverRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  attachProcessLogging(child);
  flaskProcess = child;
  flaskOwnedByElectron = true;

  child.once("error", (error) => {
    appendLogLine(getLogPaths().stderr, `${error.stack || error.message}\n`);
  });

  return child;
}

async function waitForFlaskServer() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
    if (await requestHealthcheck()) {
      return;
    }

    if (flaskProcess && flaskProcess.exitCode !== null) {
      throw new Error(
        [
          "O processo Flask foi encerrado antes do healthcheck responder.",
          `Código de saída: ${flaskProcess.exitCode}`,
        ].join("\n"),
      );
    }

    await new Promise((resolve) => setTimeout(resolve, HEALTHCHECK_INTERVAL_MS));
  }

  throw new Error("O servidor Flask não respondeu dentro do tempo limite configurado.");
}

function stopFlaskProcessSync() {
  if (!flaskOwnedByElectron || !flaskProcess || cleanupCompleted) {
    return;
  }

  cleanupCompleted = true;

  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(flaskProcess.pid), "/t", "/f"], {
        windowsHide: true,
        stdio: "ignore",
      });
    } else {
      flaskProcess.kill("SIGTERM");
    }
  } catch (_error) {
    // Encerramento defensivo: não bloqueia o quit do Electron.
  } finally {
    flaskProcess = null;
    flaskOwnedByElectron = false;
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: PRODUCT_NAME,
    show: false,
    icon: getIconPath(),
    autoHideMenuBar: true,
    backgroundColor: DEFAULT_BACKGROUND,
    transparent: false,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.removeMenu();
  mainWindow.maximize();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(BASE_URL) || url.startsWith("http://127.0.0.1:8000/")) {
      return { action: "allow" };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => {
    if (mainWindow) {
      mainWindow.show();

      // 🔥 AQUI ESTÁ O AJUSTE DE ZOOM
      mainWindow.webContents.setZoomFactor(0.8);

      // 🔒 (opcional) trava o zoom pra ninguém mudar
      mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(BASE_URL);
}

async function bootstrapDesktopApp() {
  const portStatus = await ensurePortReadyForElectron();

  if (!portStatus.reusedExistingServer) {
    spawnFlaskServer();
    await waitForFlaskServer();
  }

  createMainWindow();
}

if (singleInstanceLock) {
  app.on("second-instance", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  });

  app.setAppUserModelId(APP_ID);

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);

    try {
      await bootstrapDesktopApp();
    } catch (error) {
      stopFlaskProcessSync();
      showFatalError(getStartupErrorMessage(error.message));
      app.quit();
    }
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      try {
        if (!(await requestHealthcheck())) {
          await bootstrapDesktopApp();
          return;
        }
        createMainWindow();
      } catch (error) {
        showFatalError(getStartupErrorMessage(error.message));
        app.quit();
      }
    }
  });

  app.on("before-quit", () => {
    quittingAfterCleanup = true;
    stopFlaskProcessSync();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin" || quittingAfterCleanup) {
      app.quit();
    }
  });
}

module.exports = {
  BASE_URL,
  HEALTHCHECK_PATH,
  buildPythonPath,
  getEnvironmentFilePath,
  getServerRoot,
  getStorageDirectory,
  resolvePythonExecutable,
  requestHealthcheck,
};
