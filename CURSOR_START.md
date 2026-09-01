# Cursor bootstrap (do this first)

## 1. Clone and open

```bash
cd ~/Developer   # or wherever you keep code
git clone https://github.com/kvnpyy/anarlog.git
cd anarlog
git checkout feature/granola-live-ask
```

Open the `anarlog` folder in **Cursor** (File → Open Folder).

## 2. Toolchain (macOS)

You need:

- **Node.js 22+** — https://nodejs.org or `brew install node@22`
- **pnpm 11.1.1** — `corepack enable && corepack prepare pnpm@11.1.1 --activate`
- **Rust 1.94.0** — https://rustup.rs then `rustup default 1.94.0` (or whatever `rust-toolchain.toml` pins)
- **Xcode Command Line Tools** — `xcode-select --install`
- **Tauri macOS prerequisites** — https://v2.tauri.app/start/prerequisites/

## 3. Install and run desktop

```bash
pnpm install --frozen-lockfile
pnpm exec turbo dev:desktop
```

First Rust compile is slow (can be 10–30+ min). Later runs are faster.

When the window opens:

1. Grant mic + screen/system audio permissions when macOS asks
2. Settings → Intelligence → add your **Claude API key**
3. Settings → Transcription → pick a **live** model if available
4. Start a Quick Note / Record, talk for 1 minute, stop, confirm memo + summary work

## 4. Then open FORK.md

Implement **Phase 1 only** with Cursor Agent using the prompt in `FORK.md`.

## Common failures

| Symptom | Fix |
| --- | --- |
| `pnpm` not found | corepack / install pnpm 11.1.1 |
| Rust version mismatch | `rustup show` + install version from `rust-toolchain.toml` |
| Tauri / linker errors | install Xcode CLT + Tauri mac deps |
| App builds but no system audio | macOS Privacy → Screen Recording + Microphone for the app |
| Chat does nothing | Intelligence provider key missing |
| Live ask has no context | transcription model is batch-only; switch to live STT |

## Do not

- Start by redesigning the whole app theme
- Rename the product across every package on day 1
- Commit API keys
- Touch `enterprise/`
