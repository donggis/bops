/**
 * Small OS boundary for the Electron shell.
 *
 * Keep OS-specific process and path behavior here instead of spreading shell commands through
 * desktop/main.cjs. This module deliberately does not decide whether a process is safe to stop:
 * callers must verify ownership before invoking stopProcessTree().
 */
const { execFile } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");

const PORT = 3210;

function run(file, args, timeout = 3000) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout, windowsHide: true, encoding: "utf8" }, (error, stdout) => {
      resolve(error ? "" : String(stdout || ""));
    });
  });
}

/** Return the PATH available to child processes launched by the desktop app. */
function loginPath(platform = process.platform, env = process.env) {
  if (platform === "win32") return env.PATH || env.Path || "";
  if (platform === "darwin") {
    return [...new Set([...(env.PATH || "").split(path.delimiter).filter(Boolean), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"])].join(path.delimiter);
  }
  return env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";
}

/** Parse netstat -ano output. Exported separately so it can be tested without Windows. */
function parseWindowsNetstat(output, port = PORT) {
  const listeners = [];
  for (const line of String(output).split(/\r?\n/)) {
    const match = /^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i.exec(line);
    if (match && Number(match[1]) === port && Number(match[2]) > 0) {
      listeners.push({ pid: Number(match[2]), platform: "win32" });
    }
  }
  return listeners;
}

/** Find processes listening on Bops' local port. This is discovery only, not permission to kill them. */
async function findPortListeners({ platform = process.platform, port = PORT } = {}) {
  if (platform === "win32") {
    const output = await run("netstat.exe", ["-ano", "-p", "tcp"]);
    return parseWindowsNetstat(output, port);
  }
  if (platform === "darwin" || platform === "linux") {
    const output = await run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
    return output.split(/\s+/).map(Number).filter((pid) => Number.isInteger(pid) && pid > 1).map((pid) => ({ pid, platform }));
  }
  return [];
}

/**
 * Stop a process tree after the caller has verified it belongs to this Bops instance.
 * Windows has no POSIX process groups; taskkill /T stops descendants as well.
 */
async function stopProcessTree(pid, { platform = process.platform, signal = "SIGTERM" } = {}) {
  if (!Number.isInteger(pid) || pid <= 1) throw new TypeError("A valid process id is required.");
  if (platform === "win32") {
    const output = await run("taskkill.exe", ["/PID", String(pid), "/T", "/F"], 10_000);
    return /SUCCESS/i.test(output);
  }
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      return false;
    }
  }
  return true;
}

/** A per-user Windows named pipe replaces the Unix-domain socket used for browser rendering. */
function getRenderSocketPath({ platform = process.platform, userData, tempDir = os.tmpdir(), pid = process.pid } = {}) {
  if (platform === "win32") return "\\\\.\\pipe\\bops-render-" + pid;
  if (!userData) throw new TypeError("userData directory is required.");
  const file = path.join(userData, "render.sock");
  return Buffer.byteLength(file) < 100 ? file : path.join(tempDir, "bops-render.sock");
}

/** Windows and macOS both use Electron's userData directory; only the default log location differs. */
function getLogDirectory({ platform = process.platform, app } = {}) {
  if (!app || typeof app.getPath !== "function") throw new TypeError("Electron app is required.");
  if (platform === "win32") return path.join(app.getPath("userData"), "logs");
  return app.getPath("logs");
}

module.exports = { PORT, loginPath, parseWindowsNetstat, findPortListeners, stopProcessTree, getLogDirectory, getRenderSocketPath };
