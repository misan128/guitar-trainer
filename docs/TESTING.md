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
- [ ] Eye open: the path, the gold current note, the next note highlighted with the arrow; the arrow turns at the top note.
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
