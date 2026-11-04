const test = require("node:test");
const assert = require("node:assert/strict");
const {
  loginPath,
  parseWindowsNetstat,
  getLogDirectory,
} = require("../desktop/platform.cjs");

test("Windows PATH is taken from the Windows environment without invoking a Unix login shell", () => {
  assert.equal(loginPath("win32", { PATH: "C:\\Windows\\System32" }), "C:\\Windows\\System32");
  assert.equal(loginPath("win32", { Path: "C:\\Windows" }), "C:\\Windows");
});

test("macOS PATH keeps standard Homebrew and system locations", () => {
  const value = loginPath("darwin", { PATH: "/custom/bin:/usr/bin" });
  assert.match(value, /\/opt\/homebrew\/bin/);
  assert.match(value, /\/custom\/bin/);
});

test("Windows netstat parser returns only listeners on the requested port", () => {
  const sample = [
    "  Proto  Local Address          Foreign Address        State           PID",
    "  TCP    0.0.0.0:3210           0.0.0.0:0              LISTENING       4120",
    "  TCP    127.0.0.1:3211         0.0.0.0:0              LISTENING       4121",
    "  TCP    [::]:3210              [::]:0                 LISTENING       4122",
    "  TCP    127.0.0.1:3210         127.0.0.1:55000        ESTABLISHED     4123",
  ].join("\r\n");
  assert.deepEqual(parseWindowsNetstat(sample), [
    { pid: 4120, platform: "win32" },
    { pid: 4122, platform: "win32" },
  ]);
});

test("Windows log directory stays inside Electron userData", () => {
  const app = { getPath: (key) => key === "userData" ? "C:\\Users\\Test\\AppData\\Roaming\\Bops" : "unexpected" };
  assert.equal(getLogDirectory({ platform: "win32", app }), "C:\\Users\\Test\\AppData\\Roaming\\Bops\\logs");
});
