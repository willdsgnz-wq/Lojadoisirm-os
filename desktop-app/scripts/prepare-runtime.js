const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const desktopRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(desktopRoot, "..");
const runtimeRoot = path.join(desktopRoot, "runtime");
const pythonTargetRoot = path.join(runtimeRoot, "python");
const defaultEnvRoot = path.join(runtimeRoot, "default-env");
const assetsRoot = path.join(desktopRoot, "assets");

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function copyFileIfPresent(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return false;
  }

  ensureDirectory(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
  return true;
}

function resolvePythonHomeFromCommand(command, args) {
  try {
    const result = spawnSync(command, args, {
      cwd: projectRoot,
      encoding: "utf8",
      windowsHide: true,
    });

    if (result.status !== 0) {
      return "";
    }

    return String(result.stdout || "").trim();
  } catch (_error) {
    return "";
  }
}

function resolvePythonHome() {
  const explicitHome = String(process.env.DESKTOP_APP_PYTHON_HOME || process.env.PYTHON_HOME || "").trim();
  if (explicitHome) {
    return explicitHome;
  }

  const codexRuntime = path.join(
    os.homedir(),
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "python",
  );
  if (fs.existsSync(path.join(codexRuntime, "python.exe"))) {
    return codexRuntime;
  }

  const pythonByCommand = resolvePythonHomeFromCommand("python", [
    "-c",
    "import pathlib, sys; print(pathlib.Path(sys.executable).resolve().parent)",
  ]);
  if (pythonByCommand && fs.existsSync(path.join(pythonByCommand, "python.exe"))) {
    return pythonByCommand;
  }

  const pyLauncherHome = resolvePythonHomeFromCommand("py", [
    "-3",
    "-c",
    "import pathlib, sys; print(pathlib.Path(sys.executable).resolve().parent)",
  ]);
  if (pyLauncherHome && fs.existsSync(path.join(pyLauncherHome, "python.exe"))) {
    return pyLauncherHome;
  }

  return "";
}

function copyDirectory(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
  fs.cpSync(sourcePath, targetPath, {
    recursive: true,
    force: true,
    filter: (entry) => {
      const lower = entry.toLowerCase();
      return !lower.includes("__pycache__") && !lower.endsWith(".pyc");
    },
  });
}

function prepareIcons() {
  ensureDirectory(assetsRoot);

  const icoSource = path.join(projectRoot, "frontend", "static", "icons", "favicon.ico");
  const pngSource = path.join(projectRoot, "frontend", "static", "icons", "icon-512.png");

  copyFileIfPresent(icoSource, path.join(assetsRoot, "app-icon.ico"));
  copyFileIfPresent(pngSource, path.join(assetsRoot, "app-icon.png"));
}

function prepareDefaultEnvironment() {
  ensureDirectory(defaultEnvRoot);

  const envSource = fs.existsSync(path.join(projectRoot, ".env"))
    ? path.join(projectRoot, ".env")
    : path.join(projectRoot, ".env.example");

  if (!copyFileIfPresent(envSource, path.join(defaultEnvRoot, ".env"))) {
    throw new Error("Nenhum arquivo .env ou .env.example foi encontrado para preparar o desktop app.");
  }
}

function preparePythonRuntime() {
  const pythonHome = resolvePythonHome();
  if (!pythonHome) {
    throw new Error(
      [
        "Não foi possível localizar um runtime Python para embutir no instalador.",
        "Defina DESKTOP_APP_PYTHON_HOME apontando para uma pasta que contenha python.exe.",
      ].join("\n"),
    );
  }

  copyDirectory(pythonHome, pythonTargetRoot);
}

function main() {
  prepareIcons();
  prepareDefaultEnvironment();
  preparePythonRuntime();
  console.log("Runtime desktop preparado com sucesso.");
  console.log(`Python embutido em: ${pythonTargetRoot}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
