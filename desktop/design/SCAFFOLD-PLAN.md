# CA4 scaffold plan — Tauri app shell (rd-os)

**do:** create `desktop/` (preferred) OR `app/` — one tree only  
**do not:** touch `src/db*`, `src/lock*`, `board/`, kernel MCP runtime  
**design SoT:** `TAURI-SHELL-SPEC.md` + `waiting-greyscale.html` + `tokens.css` (this folder)  
**Studio:** design only — CA4 implements  

## Goal
Local-first window that opens on **Waiting** greyscale table (what / waiting on / age). Shell nav stubs for Experiments / History / Settings.

## Steps (ordered)

1. **Scaffold** Tauri 2 + frontend (Vite + TS; React or Svelte — eng pick; one framework).
2. **Wire tokens** from `tokens.css` into global styles.
3. **AppShell + Nav** — routes: waiting (default), experiments, history, settings.
4. **WaitingView** — port `waiting-greyscale.html` 1:1 structure (table, human row actions, empty + in-flight states). Greyscale only.
5. **attention read** — stub: load `attention.dump` JSON from `$RDOS_HOME` or local fixture; missing dump → error panel (no fake P0).
6. **Stub views** — Experiments / History / Settings shells with empty copy; Settings includes plain Rules list (5 HARD LAW sentences as text, not chips).
7. **Proof** — screenshots: human / empty / in-flight / dump-missing; stranger: `cargo tauri build` or documented `tauri dev` cold path.

## Acceptance (gate)
- [ ] Cold open → Waiting ≤30s readable
- [ ] Columns what | waiting on | age (tabular)
- [ ] Approve/Reject only on human row
- [ ] Greyscale only
- [ ] No edits under board/ or locked kernel paths
- [ ] README in desktop/ with run cmds

## Out
Glass/copper costume, MCP server, second CA, merge from CA, 14d clock.
