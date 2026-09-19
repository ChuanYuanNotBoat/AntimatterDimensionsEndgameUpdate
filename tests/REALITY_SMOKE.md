# ADE Reality end-to-end smoke test (local development)

This is different from the mocked `node --test` unit tests: the runner opens a **new, disposable Edge/Chromium browser context**, decodes a real exported save, calls `GameStorage.loadPlayerObject()`, runs the **real `gameLoop()` and autobuyers** for a bounded number of ticks, then calls the **real `autoReality()`** if Reality is available. It reports the earliest thrown error with its phase and tick number. It never launches your normal browser profile, never uses cloud credentials, and disables save/backup writes and background intervals in the test page.

## First-time setup (Windows PowerShell)

1. Export a copy of the endgame save. Keep it local and out of Git. Copy it to `tests/fixtures/local-overflow-save.txt`, or pass its absolute path every time. `tests/fixtures/.gitignore` excludes all fixture files.
2. In the project root, install the runner dependency **without modifying package-lock.json**: `npm install --no-save --package-lock=false playwright`. The script first tries your installed Microsoft Edge; if Edge is missing it tries Playwright's Chromium (which may need `npx playwright install chromium`).
3. Start the local **patched** game in another terminal: `npm run serve`.

## Every subsequent patch

```powershell
node --test .\tests\*.test.cjs
node .\tests\run-reality-smoke.cjs
```

To use another local save without copying it:

```powershell
node .\tests\run-reality-smoke.cjs "E:\path\to\exported-save.txt" --ticks 250
```

If the dev server is running on another port, pass `--url http://127.0.0.1:8081/`. To reproduce an extreme Singularity exponent starting from an older save, pass `--stress-singularities` (a synthetic change to the **disposable** in-memory save only). For the **manual-glyph Reality path**, pass `--manual`; the default is the automatic Reality path. Use `--ticks 0` to test the Reality reset immediately without ticking. `--step-ms 50` controls each simulated tick.

- **passed**: an actual Reality occurred and `player.realities` increased.
- **failed**: the first synchronous failure is shown under `phase` and `tick`, with a stack trace and relevant CD/singularity diagnostics. Uncaught browser errors also cause failure.
- **not-ready**: the save did not meet Reality requirements even after the requested ticks. This is deliberately a failure, **not** a forged Reality completion; provide a ready save or increase ticks.
- **no-reset**: a Reality was requested but did not increase `player.realities`; inspect the diagnostic and asynchronous logs.

The runner never uses `GameStorage.import()` (which saves), does not patch the game's calculations, and does not touch your regular browser's save. Exporting a newer save is the only manual fixture update needed when you want to reproduce a newly reached endgame stage. Do **not** commit the exported save to a public repository.

**Limitation:** Browser smoke tests require the complete application and its dependencies. A source-only archive without `package.json` or `node_modules` can run the unit tests but cannot execute this browser test; the script must run in your full project alongside `npm run serve`.
