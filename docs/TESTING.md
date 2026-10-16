# Testing

Two layers: automated tests for the logic that is easy to get silently wrong, and a manual pass for what only a real browser and phone can show (sound, touch, install, offline).

## Automated tests

From the repo root:

```sh
node --test
```

Node 18 or later, no dependencies, no `npm install`. Node finds every `*.test.js` under `tests/`. All tests must pass before a change is committed.

| File | What it checks |
| --- | --- |
| `tests/theory.test.js` | Every key × start note × fret zone the panel allows (5 frets or more) has a fretboard walk where each fret sounds the pitch played, stays inside the zone, never moves to a lower string while ascending, follows the scale steps, and spans at most 4 frets. Also: the same input always gives the same fingering, octave 3 is used in central zones, 4-fret zones really fail (why the minimum is 5), two known fingerings, and scale spelling (F♯, D♭…). |
| `tests/strings.test.js` | Languages are listed EN, EU, ES, and every language has the same text keys, of the same kind (text or function), none empty. |

They test `theory.js` and `strings.js` directly. `index.html` (UI, audio, drawing) is covered by the manual pass below.

**Adding a test:** create `tests/<name>.test.js` using `node:test` and `node:assert/strict`, as the existing ones do. `theory.js` loads with `require("../theory.js")`; `strings.js` needs `global.window = {}` before `require`.

**When to touch them:** changing the fingering rules, the zone limits, `OPEN_MIDI`, or adding a language or a text key.

## Running the app locally

Serve the folder over HTTP. Opening `index.html` as a file works, but the service worker (offline) does not run there.

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. `localhost` counts as secure, so the service worker and Wake Lock work.

To start clean, as a first-time user: DevTools → *Application* → *Storage* → *Clear site data*. That brings back the first-use guide and the default settings.

## Dev mode

Add `?debug` to the URL: `http://localhost:8000/?debug`, or with VS Code Live Preview `…/index.html?vscode-livepreview=true&debug`. Without `?debug` none of this exists, so users never see it.

The idea: the panel is a cursor over the round. Whatever you change shows, and sounds, at once; from there you can pause, step, or play on.

**Panel:** a small **dbg** pill appears at the top right; drag it anywhere, or tap it to turn it into the panel, grown from its top-right corner. Drag the panel by its header. Its **−** button, tapping outside it, or `Esc` shrinks it back into the pill at the panel's top-right corner, so an unmoved panel folds back exactly where it started.

| Control | Running | Paused | Stopped |
| --- | --- | --- | --- |
| **⏸ / ▶** | Pause on the current tick | Play on from the cursor | — |
| **⏭** | — | Next tick, immediately, with its sound (at the end it moves on to a new round) | — |
| **round: key** | Swap the key on the fly, same start degree and position | Swap it and sound the note at the same position | Draw that key's walk from the tonic |
| **walk: degree · slider** | Jump to that note on the next tick | Go to that note and sound it | Move along the drawn walk |

The degree select and the slider are one control: the current note of the walk, as a scale degree and as a position (0–14). Moving the slider updates the degree; choosing a degree moves the slider to that note, the nearest one if it appears both on the way up and on the way down. While running, key, degree and slider follow the current round and note. The round's start degree is the one the app drew; `dbg.round()` in the console can force it. Below them, a live line shows the phase, tick, key and degree, and the fingering.

**Console:** the state line is printed as `[dbg] …` every time it changes (each tick, pause, stop), and so is the result of every action, even with the panel closed. The same controls are available as commands:

| Command | What it does |
| --- | --- |
| `dbg.help()` | Lists the commands. |
| `dbg.pause()` / `dbg.resume()` | Stop on the current tick / play on from it. |
| `dbg.step()` | Paused: next tick now. |
| `dbg.seek(i)` | Go to walk note `i` (0–14): now if paused, on the next tick if running. |
| `dbg.round("G", 3)` | Swap the current round for G major from degree 3 (1 = tonic … 7), same position. `F#` and `Db` work too. |
| `dbg.walk("C", 1, 7, 11, i)` | Stopped: draw that walk on frets 7–11 with the current note at walk index `i` and return its fingering, e.g. `E8 E10 A7 A8 A10 D7 D9 D10`. Zone defaults to the panel's. |
| `dbg.state()` | Phase, tick, key and degree, the walk's fingering, and the settings. |

Pausing stops the scheduler and silences what it had already queued; stepping, seeking or swapping the round plays that one tick right away; resuming schedules the next tick one beat later.

## Manual pass

Do it on the phone after changes to the UI, audio or service worker, and before publishing. It needs the published site (HTTPS) or a local server reachable from the phone over HTTPS.

**First use**
- [ ] The guide opens with the language step; choosing a language switches the whole app at once.
- [ ] Next, Skip and `Esc` work; after finishing it does not come back on reload; **?** reopens it without the language step.

**Practice**
- [ ] Start: the reference note sounds, then prep clicks, 8 notes up and 7 down, then the wait. Clicks and notes stay in time at 60 and at 240 BPM.
- [ ] Stop cuts the sound at once.
- [ ] BPM changes while running take effect on the next beat.
- [ ] Several keys: the key changes between rounds and the wait announces the next one.

**Controls**
- [ ] Slider: tapping anywhere jumps there; dragging works; dragging never scrolls the page.
- [ ] `−` / `+`: a tap changes by exactly 1; holding repeats and stops the moment you let go; it never goes past 30 or 300.
- [ ] Keys panel: the last selected key cannot be deselected; Clear goes back to C major.

**Fretboard**
- [ ] On by default for a new user, zone 2–6.
- [ ] Eye open: the path, the gold current note lit in place (nothing slides), a faint gradient on the segment to the next note that turns at the top note; played positions dimmer than upcoming ones.
- [ ] At 240–300 BPM the fretboard feels steady and never lags behind the sound.
- [ ] Eye closed: only the start position.
- [ ] What you hear matches the marked fret (play along on the guitar).
- [ ] Fretboard off: the big note letter is back and everything looks as before.

**Phone**
- [ ] Everything fits on one screen without scrolling, with and without the fretboard.
- [ ] The screen stays on while practicing.
- [ ] iPhone: it plays with the silent switch on.
- [ ] Installed on the home screen: correct name and icon, opens full screen.
- [ ] After one load online, it opens and works in airplane mode, fonts included.
- [ ] After publishing a change (cache version bumped), the installed app picks it up when reopened.

The full list of acceptance criteria is in `docs/SPEC.md` §10.
