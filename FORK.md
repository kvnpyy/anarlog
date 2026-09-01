# Personal fork plan — Granola-style UX on Anarlog

This is **kvnpyy’s private product plan**, not upstream Anarlog docs.
Fork of `fastrepl/anarlog` (MIT community app). Keep `LICENSE`. Do not ship or modify `enterprise/` without reading `LICENSING.md`.

## Goal

Ship a **local-first** meeting notepad that feels as close as possible to Granola:

1. No bot — system audio + mic (already in Anarlog)
2. Scratch notes while listening (RawEditor / Memos)
3. One notepad: type during the call; after stop, auto-enhance from your notes + transcript
4. **Always-on Ask rail** during the meeting, bound to the **live transcript**
5. Recipes: *Catch me up* · *Sound smart* · *Draft email*
6. Auto-delete sessions/audio older than **365 days**
7. Calmer UI (less chrome, one note = one page)

**Non-goals (v1):** ads, CloudSync, team sharing, marketing site, mobile, rename of every crate.

## Product layout (target)

```
[ compact window: top-right, ~33% of screen height, notes list open ]
[ one notepad column ]
  during call: your personal notes (or transcript if you open it)
  Ask rail docked under the notes in the same column
  after stop: auto-enhanced note (your notes + transcript, nothing left behind)
[ floating record control ]
```

## Build order (do in this order)

### Phase 0 — Build runs on your Mac

1. Clone this repo, checkout `feature/granola-live-ask`
2. Install Node 22+, pnpm 11.1.1, Rust 1.94.0, Tauri v2 macOS deps
3. `pnpm install --frozen-lockfile`
4. `pnpm exec turbo dev:desktop`
5. Confirm: record a test call, see transcript/memo, stop → summary

If Phase 0 fails, **stop**. Fix environment before any UI work.

### Phase 1 — Live Ask rail (the only feature that matters)

Find existing Chat UI under `apps/desktop` (session / right panel / chat view).

Changes:

- While a session is **recording**, dock Ask under the notepad in the **same column** (not a second pane)
- On every user message (and recipe buttons), prepend the **last N minutes** of the in-progress transcript as context
- Three fixed buttons above the input:
  - **Catch me up** → short bullets of what was said in the last ~5–10 min + what I should say next
  - **Sound smart** → 2–3 concise talking points in my voice
  - **Draft email** → follow-up email draft from the meeting so far

Intelligence provider: your Anthropic (Claude) API key in Settings → Intelligence. Prefer a fast model for live prompts.

Transcription: only models marked **live** during recording. Batch-after-stop models make the rail fake.

### Phase 2 — Enhance flow

- After stop, auto-enhance into the same notepad (no split panes, no Enhance / retry chrome)
- Merge the user's personal notes with the transcript so nothing is left behind
- Do not invent a second note system — use existing Raw + Enhanced paths

### Phase 3 — 365-day retention

- On app launch or idle, delete local sessions, documents, and audio files older than 365 days
- Prefer extending whatever retention setting already exists in settings/DB
- Schema changes must stay downgrade-safe (see `AGENTS.md`)

### Phase 4 — UI cleanup (only after 1–3 work in real meetings)

- Strip non-essential chrome during a meeting session
- Default to one notepad + ask rail
- Hide cloud upsell / account noise for local-only use

## Cursor rules for this fork

When asking Cursor to implement:

1. Read `AGENTS.md` and `CONTRIBUTING.md` first
2. Prefer TypeScript changes in `apps/desktop` and `packages/*` over Rust unless audio/STT is broken
3. Do not touch `enterprise/`
4. Do not add ads, telemetry of meeting content, or forced cloud
5. Small PRs: one phase per branch if possible
6. After edits: `pnpm exec dprint fmt` and `pnpm -F desktop typecheck` when feasible

### Paste this into Cursor Agent for Phase 1

```
You are working in a fork of Anarlog (Tauri + React). Goal: while a meeting is recording, show an always-visible Ask chat rail that can query the LIVE in-progress transcript (last N minutes), with three recipe buttons: Catch me up, Sound smart, Draft email. Reuse existing Chat components and Intelligence provider settings. Do not rewrite audio capture. Find the session view, transcript buffer, and chat panel; wire live context into chat prompts when status is recording. Keep changes minimal and focused on apps/desktop + packages.
```

## What stays upstream’s problem

- System audio capture reliability
- Whisper / local STT performance
- Calendar join flows that already work

Pin this fork. Do not merge upstream `main` every week unless you need a critical fix.

## Success criteria

Use the app on **10 real work calls**. Keep it only if you open the Ask rail more than you open Granola/Jamie. Otherwise abandon.
