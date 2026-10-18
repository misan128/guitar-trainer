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
| `tests/theory.test.js` | Start notes: one key covers all seven in every pass of 7 rounds; with 2–12 keys, no start note twice in a row, no repeat within a key and no degree waiting more than 15 rounds of its key. Fretboard: every key × start note × fret zone the panel allows (5 frets or more) has a fretboard walk where each fret sounds the pitch played, stays inside the zone, never moves to a lower string while ascending, follows the scale steps, and spans at most 4 frets. Also: the same input always gives the same fingering, octave 3 is used in central zones, 4-fret zones really fail (why the minimum is 5), two known fingerings, and scale spelling (F♯, D♭…). |
| `tests/pentatonic.test.js` | The five minor pentatonic shapes (SPEC §15.2): in A minor, every note in the scale, two notes per string on all six strings, a route that climbs through the scale without skipping a note, within 5 frets, the exact routes and fret ranges of the spec table, note names, degrees and roots. In all 12 minor keys: every shape fits (movable, frets 1–16), geometry and degrees are kept, the lowest movable placement is the default, notes are in the key and spelled after its key signature. Placements: the five open-position ones (E1, D2, C3, A4, G5), the nine combinations with two places an octave apart, and any placement keeping the geometry. Along the neck: shapes in fret order with their chosen placement, and the walk to the neighbouring shape turning at both ends. |
| `tests/pitch.test.js` | The tuner's pitch detection (SPEC §16): every open string within 1 cent from a pure tone, within 3 cents with overtones louder than the fundamental and some noise, and from a plucked string; offsets of ±5 to ±30 cents read as such; drop D reads; silence, very quiet sound and noise give no reading; note names, octaves and cents. The four tunings: standard is the app's tuning, ½ step down is every string a semitone lower, drop D is D A D G B e, e → D is E A D G B d, every string named after its pitch and within the tuner's range. |
| `tests/chords.test.js` | Progressions (SPEC §17.5): the six, transposed (C G Am F, Dm G C×2, Am G F E in A minor, the blues' twelve bars in A…), every chord existing in its position in every key, and the positions chosen for you: open when there is one, otherwise the closest to the chord before. Chord changes (SPEC §17): 36 chords (every root, major, minor and 7th), each with at least two positions (open, root on the 6th, 5th or 4th string), none starting above fret 11, the easiest first when two start on the same fret; the 14 standard open chords; known fingerings (F 133211 and the small F xx3211, Bm x24432, E7 xx2434…). For every voicing: every sounding note in the chord, every chord tone sounding (a 7th may drop its fifth), the root in the bass, fingers 1–4 with only the barre finger on several strings, nothing under the barre, fingers in fret order, within the diagram's four frets; positions sorted along the neck. The sequence: changes land on the right ticks for 2, 4 and 8 ticks per chord over 10,000 ticks, and chords of different lengths (for future progressions). |
| `tests/strings.test.js` | Languages are listed EN, EU, ES, and every language has the same text keys, of the same kind (text or function), none empty. |

They test `js/theory.js` (including the chords), `js/pitch.js` and `js/strings.js` directly. The app in `js/app/` (UI, audio, drawing) is covered by the smoke tests and the manual pass below.

**Adding a test:** create `tests/<name>.test.js` using `node:test` and `node:assert/strict`, as the existing ones do. `js/theory.js` loads with `require("../js/theory.js")`; `js/strings.js` needs `global.window = {}` before `require`.

**When to touch them:** changing the fingering rules, the zone limits, `OPEN_MIDI`, or adding a language or a text key.

## Smoke tests

The app in a real browser: Chromium with an iPhone 13 viewport, driven by Playwright, on a tiny static server over the repo. They check that the main flows run and show, not how they look:

| Test | Checks |
| --- | --- |
| Load | No errors; the pick at rest; `debug.js` not requested without `?debug`. |
| Scale walk | Start lights a position on the fretboard; stop hides it. |
| Pentatonic along the neck | From A minor shape 1, the neck bar shows 1, points to 2 on the way down, slides to 2, and only one zone is left. |
| Eye | Four taps go through levels 2, 3, 4, 1, and the level is saved. |
| Menu: language | Spanish and Basque, chosen in the menu, change the texts (the menu's too); the choice is saved. |
| Menu: themes, About, guide | Maple changes the background and is saved; Steel has a background of its own and its teal accent reaches the pick; About shows the text and the coffee link; Help opens the guide and closes the menu. |
| Theme at first paint | A saved Maple theme is already applied when the page loads, and a theme saved under its earlier name (Material) comes back as Steel. |
| Dev mode | `?debug` loads `dbg`; pause, step and back return to the same tick. |
| Chord changes: setup | Chords as tiles with name, fingering and position; the picker replaces the panel, each type shows the chord it gives; picking A's chord for B swaps them with B's chord from before; ticks per chord; saved; back to Scale walk hides the chords. |
| Chord changes: progressions | Progression mode replaces the tiles, "Ticks per bar", the button reads "C · G · Am · F" (its chords), each progression shows its chords in the key, the strip behind the panel; the blues in A groups its bars on one line; the Andalusian cadence reads the key as A minor; saved; playing follows the strip, and F comes as the small F. A two-bar chord shows one bar of dots, ringed only in its last bar. |
| Chord changes: positions | In the picker, Am's three positions as small diagrams, open pressed; the 6th-string barre shows "5fr", no open or muted strings, and the tile follows; F starts as the small F (4th string) before the full barre, drawn at fret 1 with the nut; the choice saved per chord; Esc closes the panel. |
| Chord changes | At rest: Am now and C next, Am's three fingers with their numbers, two open and one muted string, two tick dots, no bars, no fretboard button, Ticks after disabled. Playing: C becomes current with Am next, then Am again, one tick lit. No eye in Chords, both chords in full with finger numbers whatever the saved level, and the eye back in Scale walk; dev mode runs. |
| Tips | The menu's tour the first time, over the open menu, and not twice; the setup's exercise row once, then each exercise's tips (Chords, Progression on switching, Pentatonic, Scale walk); the picker's and the tuner's; Skip counts as seen; Show the tips again brings them back; none while practising. |
| Tuner | With a fake microphone playing the A string 12 cents sharp: the panel reads A2, settling at +9 to +15 cents, marks the A reference and shows the level as heard, and closes. The reference buttons follow the tuning (E A D G B e · E♭ A♭ D♭ G♭ B♭ e♭ · D A D G B e · E A D G B d), each tuning button shows its notes, and the choice is saved; they play; Esc closes; the tuner is disabled while practising. |

Once, from the repo root:

```sh
npm install
npm run smoke:setup
```

Then, before a release and after changes to `js/app/`:

```sh
npm run smoke
```

They take about 10 seconds. On Linux, if Chromium reports missing libraries, install the ones it names, e.g. on Ubuntu `sudo apt-get install libgbm1 libasound2`. Each test starts from its own saved settings (the guide already seen, English), so they do not depend on each other or on your browser. They live in `tests/smoke/` and are named `*.smoke.js`, so `node --test` alone does not run them.

## Release check

On a release or hotfix branch, before merging into `main`:

```sh
node scripts/check-cache.js
```

It compares with the latest release tag: if a file the service worker precaches changed, `sw.js` must name a new cache (`guitar-trainer-vN`), or installed apps keep the old files offline. It also checks that every precached file exists. Give a tag or commit to compare with another base: `node scripts/check-cache.js v3.0.0`.

GitHub runs the same check, and `node --test`, on every push to `main` (`.github/workflows/cache-check.yml`); a failure shows as a red cross on the commit and an email.

## Running the app locally

From the repo root (Node only, nothing to install):

```sh
npm start
```

Then open `http://localhost:8000/` (`?debug` for dev mode). Another port: `npm start -- 8001`. Ctrl+C stops it. It serves the repo as it is, without caching, so a reload shows your changes. VS Code Live Preview works too. Opening `index.html` as a file does not: the app is made of ES modules, which browsers only load over HTTP(S). `localhost` counts as secure, so the service worker and Wake Lock work.

It also prints the address on your network, for a phone on the same Wi-Fi; there the app runs, but offline and screen lock do not (they need HTTPS). Under WSL 2 that address belongs to the Linux virtual machine and the phone cannot reach it, unless WSL uses mirrored networking.

To start clean, as a first-time user: DevTools → *Application* → *Storage* → *Clear site data*. That brings back the first-use guide and the default settings.

## Dev mode

Add `?debug` to the URL: `http://localhost:8000/?debug` (with `npm start`), or with VS Code Live Preview `…/index.html?vscode-livepreview=true&debug`. Without `?debug` none of this exists, so users never see it: the tool is `js/debug.js`, and `js/app/main.js` only loads it, and exposes the small bridge it uses, with `?debug`.

The idea: the panel is a cursor over the round. Whatever you change shows, and sounds, at once; from there you can pause, step, or play on.

**Panel:** a small **dbg** pill appears at the top right; drag it anywhere, or tap it to turn it into the panel, grown from its top-right corner. Drag the panel by its header. Its **−** button, tapping outside it, or `Esc` shrinks it back into the pill at the panel's top-right corner, so an unmoved panel folds back exactly where it started.

| Control | Running | Paused | Stopped |
| --- | --- | --- | --- |
| **⏸ / ▶** | Pause on the current tick | Play on from the cursor | — |
| **⏮** | — | Previous tick, immediately, with its sound (within the round) | — |
| **⏭** | — | Next tick, immediately, with its sound (at the end it moves on to a new round) | — |
| **round: key** | Swap the key on the fly, same start degree and position | Swap it and sound the note at the same position | Draw that key's walk from the tonic |
| **walk: degree · slider** | Jump to that note on the next tick | Go to that note and sound it | Move along the drawn walk |

The degree select and the slider are one control: the current note of the walk, as a scale degree and as a position (0–14). Moving the slider updates the degree; choosing a degree moves the slider to that note, the nearest one if it appears both on the way up and on the way down. While running, key, degree and slider follow the current round and note. The round's start degree is the one the app drew; `dbg.round()` in the console can force it. Below them, a live line shows the phase, tick, key and degree, and the fingering.

**Pentatonic shapes:** the round is the selected shape, so the key and degree selects are locked; the slider steps through the shape, up and back down. Stopped, the idle preview is static. Along the neck, the key in the live line ends with `→ shape n`, the next one, and stepping past the end moves on to it. On a shape's last note the fretboard has already slid to the next zone; seeking back from there draws the current shape again.

**Console:** the state line is printed as `[dbg] …` every time it changes (each tick, pause, stop), and so is the result of every action, even with the panel closed. The same controls are available as commands:

| Command | What it does |
| --- | --- |
| `dbg.help()` | Lists the commands. |
| `dbg.pause()` / `dbg.resume()` | Stop on the current tick / play on from it. |
| `dbg.step()` | Paused: next tick now. |
| `dbg.back()` | Paused: previous tick now, back to the round's first tick. |
| `dbg.seek(i)` | Go to walk note `i` (0–14): now if paused, on the next tick if running. |
| `dbg.round("G", 3)` | Swap the current round for G major from degree 3 (1 = tonic … 7), same position. `F#` and `Db` work too. |
| `dbg.walk("C", 1, 7, 11, i)` | Stopped: draw that walk on frets 7–11 with the current note at walk index `i` and return its fingering, e.g. `E8 E10 A7 A8 A10 D7 D9 D10`. Zone defaults to the panel's. |
| `dbg.state()` | Phase, tick, key and degree (Pentatonic: shape, and → the next one along the neck), the walk's fingering, and the settings. |

Pausing stops the scheduler and silences what it had already queued; stepping, seeking or swapping the round plays that one tick right away; resuming schedules the next tick one beat later.

## Manual pass

Do it on the phone after changes to the UI, audio or service worker, and before publishing. It needs the published site (HTTPS) or a local server reachable from the phone over HTTPS.

**First use**
- [ ] The guide opens with the language step; choosing a language switches the whole app at once.
- [ ] Next, Skip and `Esc` work; after finishing it does not come back on reload; **Help** in the menu reopens it without the language step.

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

**Chord changes**
- [ ] Each diagram matches the chord you know (try playing it), finger numbers included.
- [ ] The change comes on the accented click; the strum is soft under the click.
- [ ] Both diagrams are readable on the phone, the next one clearly secondary; nothing jumps when the chord changes.

**Tuner** (a real guitar: a fake microphone cannot tell)
- [ ] The first time, the browser asks for the microphone; refusing it shows "Microphone blocked" and the reference strings still play.
- [ ] Each open string reads as its note (E2 A2 D3 G3 B3 E4) and the needle settles quickly; turning the peg moves it the right way; gold within 5 cents.
- [ ] Closing the tuner turns off the browser's recording indicator; switching to another app does too.
- [ ] iPhone: after using the tuner, practice still plays with the silent switch on.

**Tips**
- [ ] With the tips reset (menu → Show the tips again), each panel explains itself once, readable on the phone, and the panel stays usable afterwards.

**Menu and themes**
- [ ] Maple and Steel: everything is readable (fretboard, chord diagrams, tuner, panels, the guide's dimming); nothing keeps the gold or the dark of another theme.
- [ ] No flash of Sepia on load with Maple or Steel saved.
- [ ] About: the coffee button and the GitHub link open in a new tab.

**Phone**
- [ ] Everything fits on one screen without scrolling, with and without the fretboard.
- [ ] The screen stays on while practicing.
- [ ] iPhone: it plays with the silent switch on.
- [ ] Installed on the home screen: correct name and icon, opens full screen.
- [ ] After one load online, it opens and works in airplane mode, fonts included.
- [ ] After publishing a change (cache version bumped), the installed app picks it up when reopened.

The full list of acceptance criteria is in `docs/SPEC.md` §10.
