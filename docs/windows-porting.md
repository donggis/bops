# Windows porting assessment

Status: initial assessment and platform-boundary groundwork. This branch is not yet a runnable Windows build.

## Scope and baseline

- Repository: `donggis/bops`
- Baseline branch: `main`
- Baseline release observed: `0.0.41`
- Target: Windows 10/11 x64 desktop installer (`.exe`), while preserving the macOS release path.

## Findings

### Packaging

The current `package.json` release scripts invoke macOS-only targets and shell commands. The Electron Builder configuration defines only a macOS arm64 target and uses an `.icns` icon. A Windows target needs NSIS (or another Windows installer target), a Windows icon, and a Windows build pipeline.

### Electron main process

`desktop/main.cjs` is explicitly a Mac application. It currently depends on:

- `lsof` and `ps` for port/process inspection.
- POSIX process groups and signals for stopping server trees.
- An interactive `zsh` login shell to discover PATH.
- macOS bundle layout assumptions for the app Helper executable.
- macOS-specific Application Support, log, and resource layout assumptions.
- Unix-domain sockets for the hidden browser renderer service.

These are not made Windows-compatible merely by adding `electron-builder --win`.

### Updates and permissions

`desktop/updates.cjs` documents and validates Squirrel.Mac release ZIP names, macOS Applications-folder checks, and macOS translocation paths. Windows needs a separate update strategy, such as electron-updater with an NSIS target, or a deliberately manual update flow.

macOS Keychain, Automation, Full Disk Access, screen recording and microphone permission flows must be audited individually. Windows Credential Manager / Electron safeStorage and Windows privacy permissions are not drop-in equivalents.

### Server and AI execution

The Next.js server and most TypeScript business logic are Node.js based and are promising candidates for reuse. However, local computer control, Codex CLI discovery, Chrome launch, relay binaries, renderer IPC/socket transport, and any shell scripts must be checked separately. The Orgo cloud-computer path is architecturally distinct from controlling the user's local Windows desktop.

## Initial implementation in this branch

- Added `desktop/platform.cjs` as a small OS boundary for PATH selection, port-listener discovery, process-tree stopping, and log-directory selection.
- Added unit tests for Windows netstat parsing and Windows path behavior.

This module is groundwork only. It is not yet wired into `desktop/main.cjs`, so it does not by itself make the app run on Windows.

## Remaining implementation plan

1. Audit the complete Electron main process and replace direct macOS assumptions with tested platform adapters.
2. Replace Unix-domain renderer IPC with a Windows-compatible named pipe or loopback transport, preserving the existing authentication boundary.
3. Implement Windows process ownership checks before any process termination. Never kill an arbitrary process merely because it occupies port 3210.
4. Implement Windows local-computer capabilities and secure credential storage, with explicit capability differences where macOS APIs have no Windows equivalent.
5. Add Windows resources, NSIS packaging, Windows update handling, and a Windows CI build.
6. Run typecheck, existing test suite, package smoke tests, and install/uninstall tests on a real Windows 10/11 runner.

## Security constraints

- Never bundle `.env.local`, API keys, tokens, or local state.
- Do not weaken the window-token/HMAC health proof.
- Do not expose the local server to the LAN by default.
- Do not terminate unknown processes on the Bops port.
- Treat the Windows port as incomplete until a real Windows runner verifies startup, shutdown, browser rendering, local computer access, and upgrade behavior.
