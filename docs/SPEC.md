# Scale Trainer — Specification

## 1. Context

A small tool to practice guitar scales **now**, while a much larger project is developed separately. This repository is independent of that project. Nothing from it should be anticipated here.

**Scope:** two exercises on the same practice loop (metronome, prep and wait ticks, fretboard): **Scale walk** (§3, §12–§13) and **Pentatonic shapes** (§15). The app keeps changing only as using it shows a need, each change recorded here before or as it is built. Anything beyond those two exercises (improvisation, progress tracking, other instruments) belongs to the larger project (§11).

**Guiding principle:** get it working and in use as soon as possible. When in doubt, pick the simplest option. If something is not decided in this document, **ask the user before making it up** (see §9).

## 2. Starting point

- This document describes the app **as it is now**. Why some rules are the way they are, and how they got there, is in Appendix A.
- §3 is the core behavior; §5, §6 and §12–§14 build on it and say explicitly where they change it.
- No migration to frameworks, bundlers or TypeScript. It stays HTML + CSS + JS with no build step.

## 3. Core behavior

This section is for understanding the code and checking that nothing breaks.

**Round:**
1. **Announce:** a random note from the round's key (see §12), shown on screen and played once as a reference. The start note is a shuffle-bag per key: each key goes through its seven start degrees in random order, all before any repeats, and a new pass never begins with the last one of the previous pass. Two rounds in a row never start on the same note, even in different keys, whenever another choice exists. With several keys a degree waits at most 15 rounds of its key. (`createStartPicker` in `js/theory.js`, tested.)
2. **Prep:** *n* normal clicks (1–16, default 4).
3. **Walk:** 15 ticks, one note per tick: 8 notes up to the octave and 7 back down. Each tick plays the note (Karplus-Strong) with a soft click. The first walk tick has an accented (soft) click, and each note is muted when the next one arrives.
4. **Wait:** *m* normal clicks (0–16, default 4). Then a new round starts.
5. Practice continues until the user stops it. Nothing is recorded.

**Settings:**
- BPM from 30 to 300 (default 60).
- BPM controls, built for thumbs: the slider has a 48px touch area around a 7px bar (gold progress) and a 27px thumb; tapping anywhere on it jumps there, then it drags (handled in JS, since iOS only drags the thumb natively), and it never scrolls the page. On `−`/`+` (all steppers), a press steps once and holding repeats until release, with mouse or touch; the click a press leaves behind is ignored so a tap never counts twice. Slider, number and buttons stay in sync, also while running.
- Ticks before and after the walk.
- Keys: one or more of the 12 major keys, ordered by the circle of fifths and spelled after their key signature. Can only be changed while stopped. The selector sits in the top-left corner in brass (see §12).
- **Aids (the eye):** four levels of help, shown by how open the eye is. Each tap closes it one step; from closed it opens fully again. Usable while running.
  | Eye | Level | With the fretboard | Without it (the big letter) |
  | --- | --- | --- | --- |
  | Wide open | 1 · All notes | the route, every position named, the current one in gold | the letter follows each note |
  | Lid a little down | 2 · Current note | the route, only the current position named | the letter follows each note |
  | Half closed | 3 · Shape only | the route, the current position lit without its name | the start note only |
  | Closed | 4 · Start only | only the first position, named; the rest from memory | the start note only |

  The button is a brass tile at levels 1–3 and muted when closed; its accessible label and tooltip name the level ("Aids: All notes"). **Level 1 by default** (aids start on, §13.1); settings saved with the old on/off eye become level 2 (on) or 4 (off). Stored as `aid` (1–4) in `scaleWalkLight`. At level 1 the route's dots are a little larger so names fit.
- Settings are saved in `localStorage` under the key `scaleWalkLight`. **Keep that key** so the user's settings are not lost.
- With a single key selected, no multi-key element shows (§12).

**Screen:**
- While idle, an animated SVG pick is shown. On start it disappears and the note appears centered, in brass. On stop the pick comes back.
- A round progress bar is always visible.
- A phase line shows the key, the current step (prep, ascending, descending or wait) and the countdown.

**Audio:**
- With the fretboard off, the start note always plays in octave 3. With it on, the zone decides the octave (§13.2).
- The scheduler uses lookahead over `AudioContext.currentTime`, and the UI syncs with `requestAnimationFrame`, subtracting `outputLatency`.

**Shortcuts:** `Space` starts or stops; `↑`/`↓` add or subtract 1 BPM; with `Shift`, 5.

## 4. Repository

### 4.1 Commits
- Branch `main`. Existing history is not rewritten.
- Small commits following [Conventional Commits](https://www.conventionalcommits.org/), in English, using the `/conventional-commits` skill.

### 4.2 Files
```
index.html
sw.js
manifest.webmanifest
css/styles.css
js/app.js
js/debug.js
js/strings.js
js/theory.js
icons/
fonts/
tests/
docs/SPEC.md
docs/TESTING.md
README.md
LICENSE
.gitignore
```

- **Layout:** `index.html`, `sw.js` and `manifest.webmanifest` stay at the root: Pages serves `index.html` there, and a service worker only controls its own folder and below. Styles go in `css/`, scripts in `js/`, and `icons/`, `fonts/`, `docs/` and `tests/` keep their folders. No `src/`: there is no build step.
- **`.gitignore`:** system files, editors, `node_modules/`, logs, `*.zip`, AI agent directories and the loose versions folder (`.tmp/`).
- **`LICENSE`:** MIT, held by Michael Sandoval.
- **`README.md`:** in English. Describes **only what exists**: what the app does, what a round looks like, settings, shortcuts, how to install it on iPhone and Android, and a link to the published site. No roadmap or promises.
- **`index.html`:** markup only. **`css/styles.css`:** all the styles. **`js/app.js`:** the app (UI, audio, scheduler, fretboard drawing, panels and guide), one plain script with no modules, so `index.html` still opens straight from disk.
- **`js/theory.js`:** scale theory, start-note selection (§3) and fretboard walks (§13.2), with no DOM, so the tests can load it. In the browser it defines `Theory`; in Node it is a CommonJS module.
- **`tests/`:** run with `node --test` from the repo root (Node 18+, no dependencies). They check start-note selection (§3), every fretboard walk against acceptance criterion 11, known fingerings, scale spelling, and that every language has the same texts.
- **`docs/TESTING.md`:** how to run the tests, run the app locally, the dev mode, and the manual checklist for the phone.
- **Dev mode:** `?debug` in the URL adds a small **dbg** panel and a `dbg` object in the console: a cursor over the round to pause, step, seek along the walk and swap the round's key and degree, each applied and sounded at once. It lives in **`js/debug.js`**, which `js/app.js` only loads with `?debug`, after exposing a small bridge (`ScaleTrainerDev`: getters and setters for the playback state, plus the few functions the tool calls). The tool touches the app only through that bridge. Without `?debug` neither the bridge nor the file exists. It is a development tool, not a feature: its texts are English only and stay out of `strings.js`, the one exception to §5.
- **`docs/SPEC.md`:** this document. Describes state and decisions, not one-off steps.
- **Repo description** (GitHub "About" field, set by the user): *Guitar practice with a metronome, on the fretboard: scale walks in any major key and the five minor pentatonic shapes in any minor key. Static web app, no dependencies.*

## 5. Language and texts

- **Code in English:** comments, identifiers and commit messages.
- **UI texts centralized in `strings.js`:** one object per language (`en`, `es`, `eu`) with the same keys. Covers everything visible or read by screen readers: labels, buttons, phases, shortcut hint, `aria-label` and `<title>`. Note and key names (C, D♭, F♯…) are not translatable text.
- Loaded with `<script>` before the app code. No build, no `fetch`.
- **Language selector:** small and subtle in the top-right corner, showing the language code (EN / ES / EU). Saved in `localStorage` inside `scaleWalkLight` (field `lang`), without breaking previously saved settings.
- Adding a language = adding an object to `strings.js` with the same keys, without touching the rest of the code.
- **Default language** when nothing is saved: the browser's (`es*` → Spanish, `eu*` → Basque; anything else → English).
- The language **can be changed while practice is running** and applies immediately.

## 6. PWA

Goal: install it on an **iPhone** from Safari ("Add to Home Screen") and use it offline. The same manifest, icons (including maskable) and service worker also make it installable from Chrome on **Android** ("Install app").

### 6.1 Manifest
- `name` and `short_name`: **Scale Trainer** (same in every language). iOS may truncate it under the icon; that is accepted.
- `display: standalone`, `start_url: "./"` and `scope: "./"`. All paths must be **relative**, because the site is served from a subdirectory (`/scale-trainer/`).
- `background_color` and `theme_color`: the app background (`#1d1613`).
- Icons at 192, 512 and 512 *maskable*.

### 6.2 Icons
- Generated from the **SVG pick** already in `index.html`: brass on the app background.
- PNG: `apple-touch-icon` at 180×180, 192, 512 and 512 maskable with a safe-zone margin. iOS does not support SVG on the home screen.
- **Favicon** for the browser tab: `icons/favicon.svg` (the pick, brass on transparent, simplified) with `icons/favicon-32.png` as fallback for browsers without SVG favicons. Both are precached.

### 6.3 Tags in `index.html`
- `<link rel="manifest">`, `<link rel="apple-touch-icon">`, `<meta name="theme-color">`.
- `apple-mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style` (`black-translucent`, consistent with the current use of `safe-area-inset`).
- `apple-mobile-web-app-title`: Scale Trainer.
- Service worker registration.

### 6.4 Service worker
- Precaches `index.html`, `css/styles.css`, the scripts in `js/` (not `debug.js`, which only loads with `?debug`), the manifest, the icons and the fonts.
- Fonts are self-hosted in `fonts/` (latin subsets, OFL); the app makes no third-party requests.
- The cache name is versioned (`scale-trainer-v1`, etc.). Old caches are deleted on activate. **Every published change bumps the version.**
- Strategy for app files (`index.html`, `css/`, `js/`, …): network first, falling back to cache, so updates arrive without reinstalling.

### 6.5 Mobile behavior
- **Wake Lock:** keep the screen on while practice is running. Released on stop, and requested again if the page returns to the foreground with practice running. If the API does not exist, it is silently ignored.
- **Background:** if the app goes to the background while running, nothing special happens; the system suspends it.
- **iOS silent switch:** **ignored**. The app is a practice tool, so it plays like a media app: `navigator.audioSession.type = "playback"` is set before creating the audio context (Safari 17+; ignored where the API does not exist).

## 7. Deployment

- **GitHub Pages**, **public** repository, publishing from `main` / root.
- URL: `https://misan128.github.io/scale-trainer/`.
- No GitHub Actions, no build step.

## 8. Status

Everything in this document is built and published. Changes come from using it (§1): each one is specified here, tested where it is logic (§4.2), and released when the user notices it.

## 9. Pending confirmation from the user

Nothing pending right now. Add here anything that comes up and needs the user's decision.

## 10. Acceptance criteria

1. §3 holds in every language.
2. No UI text remains outside `strings.js`, and switching language changes every text.
3. The site published on GitHub Pages loads correctly from the subdirectory.
4. On iPhone (Safari) it can be added to the home screen with the correct name and icon, and it opens full screen.
5. After a first load, it opens and works in airplane mode, fonts included.
6. While practice is running, the screen does not turn off.
7. After publishing a change and bumping the cache version, the installed app picks it up when reopened.
8. Settings saved by any earlier version are preserved (same `scaleWalkLight` key; missing fields get their defaults).
9. With one key selected, no multi-key element shows; with several, every point of §12 holds.
10. With the fretboard off, the big note letter shows, nothing from §13 is drawn, and the start note plays in octave 3.
11. With the fretboard on, every walk in every zone of at least 5 frets is playable: each marked fret sounds the pitch played, stays inside the zone, never moves to a lower string while ascending, and the same key, start note and zone always give the same fingering.
12. The first-use guide shows once (language step first), can be reopened with **?**, and is never shown while practice is running.
13. Start notes follow §3: every pass of a key covers its seven start degrees, and two rounds in a row never start on the same note.
14. Pentatonic shapes (§15): every shape matches §15.2, each round plays the complete shape up and down with the fretboard in sync, and switching back to Scale walk leaves it exactly as it was.
15. Along the neck (§15.6): consecutive rounds move to the neighbouring shape on the neck and turn at both ends, with no wait between shapes.

## 11. Out of scope

Anything beyond the two exercises (§1): other scales or modes than those in §3 and §15, tuner, accounts, analytics, frameworks, build, and anything from the larger project.

## 12. Multi-key practice

Asked for by the user's guitar teacher: practice switching between keys, not just walking within one.

**Selection panel:**
- The brass button in the top-left corner opens a dark panel; it follows the app's look, not the browser's.
- 12 toggle tiles in a 3×4 grid, circle-of-fifths order (C G D / A E B / F♯ D♭ A♭ / E♭ B♭ F). Selected tiles are brass with a check mark. A counter shows "n of 12".
- Every tap applies at once; there is no Apply button.
- Quick actions: **All** (left) and **Clear** (right); each is disabled when it would change nothing.
- **At least one key is always selected:** tapping the only selected key does nothing, and **Clear** goes back to C major (disabled when that is already the selection). A saved empty selection falls back to C.
- **Round order:** *Random* (default) or *In order*.
- Closes on tapping outside, on `Esc` or on the button again. Focus moves into the panel and returns to the button on close. Tiles are buttons with `aria-pressed`.
- The button is disabled while practice is running.
- While the panel is open, the keyboard shortcuts (§3) are off.

**Button label:** one key → "C major"; two → "C, G" (circle-of-fifths order); three or more → "n keys".

**Round order:**
- *Random:* shuffle-bag. All selected keys are shuffled into a block and played once each before reshuffling. The first key of a new block is never the last key of the previous one (with two keys this alternates them).
- *In order:* the selected keys in circle-of-fifths order, cycling.
- The key changes only between rounds, at the announce. Practice is endless; there is no round counter.

**Screen while running (several keys selected):**
- The round's key is shown as a label right above the note, smaller than the note (with the fretboard on, it goes into the phase line, §13.3). The note stays the dominant element.
- During the wait ticks, the phase line announces the next key: "Next: D major · 3", so there is time to move on the fretboard.
- With one key selected, the screen is unchanged.

**Storage:** `scaleWalkLight` holds `keys` (array of key indices) and `order` (`"random"` | `"sequential"`). An older single `key` is read as `keys: [key]`.

**Texts** in `strings.js`, for every language: the "n keys" summary, panel title, "n of 12" counter, "All", "Clear", round order and its two options, and "Next: …". Counts are functions (like `keyName`) so each language builds its own plural.

## 13. Fretboard walks

Goal: learn **how to play** each scale walk across the six strings inside a limited fret zone, not just where the notes are. Each walk has one concrete string and fret per note, so it can be memorized and repeated.

### 13.1 Settings

- **Guitar button** in the top-left corner, right of the eye. Muted when the fretboard is off, a brass tile when on. It opens the **fretboard panel**, styled like the key panel (same open/close, focus and `Esc` rules; only one panel open at a time; shortcuts off while open).
- Panel contents: title "Fretboard" with an on/off **switch**; "Neck zone" with **first fret** and **last fret** selectors; a one-line note saying the walk is shown inside that range; a **Done** button that closes it.
- Zone limits: first fret 0–15, last fret up to 19, and **at least 5 frets** (last ≥ first + 4; why: Appendix A). Changing the first fret pushes the last one up if needed. Default zone: 2–6 (the part of the neck the user knows best). Fret 0 means open strings.
- No tuning selector until there is more than standard tuning (E A D G B e).
- Like the keys, the button is disabled while practice is running: the fretboard and zone are fixed per session.
- **On by default**, like the aids (§3): aids start on and players turn them off as they need them less; an aid that starts off may never be discovered. Saved settings without `board` also get it on; an explicit saved choice is kept.
- Storage: `scaleWalkLight` holds `board` (bool), `fretFrom` and `fretTo`.

### 13.2 Building the walk

- For each round, with the round's key (multi-key practice from §12 works unchanged; the zone stays the same across keys):
  1. **Start note:** chosen as in §3, but only among degrees with a valid walk in the zone. With ≥5 frets every degree has one.
  2. **Octave:** what you hear must match the marked frets, so the zone decides the octave. Octave 3 is used when the walk fits there (always for zones between 3–7 and 8–12); otherwise the octave whose start is closest to octave 3. Only with the fretboard on (§3, Audio).
  3. **Fingering:** among all string-monotone assignments inside the zone, the first by these rules, in order: smallest hand span (highest minus lowest fret), least total fret movement between consecutive notes, fewest string changes, start on the lowest string. The result is deterministic: the same key, start note and zone always give the same walk.
- Every walk is up and down one octave.
- If no walk can be built for a key (not possible with ≥5 frets, but handled), the round is played without the fretboard instead of showing a wrong fingering.

### 13.3 Display

- An SVG fretboard while practice is running with the fretboard on. While idle, the pick shows and there is no fretboard.
- Six horizontal strings, high e at the top, labeled e B G D A E; only the zone's frets; fret numbers under each fret; the nut when the zone starts at 0.
- The fretboard **replaces the big note letter** while it shows: the gold dot already names the note. The key goes into the phase line ("C major · Ascending"), also with several keys.
- **Aid levels 1–3 (eye open, §3):** the walk's positions joined by a faint brass line; during prep and wait the current position is the start note. Other scale notes in the zone are not drawn: the path is what gets memorized. Level 1 names every position; level 2 only the current one; level 3 lights the current one without its name. The feedback is built for focus at any tempo, with three levels:
  - **Current note:** the position lights up in solid gold with its name, always the same size.
  - **Next move:** the next position is a touch lighter, with a slightly stronger ring, and only the segment from the current note to it gets a faint `linearGradient` in the direction of travel, brighter at the current note and fading towards the next. No extra circle, arrow or pulse; the next note must be distinguishable without drawing attention. During prep it shows the first step; there is none during the wait. It works going up and down, and across strings.
  - **Rest of the route:** a quiet map in muted brass; positions and segments already played (behind the current one in the current direction) are dimmer than the upcoming ones.
- **Aid level 4 (eye closed):** only the start position, in gold, for the whole round; the rest has to be found by the player.
- **Nothing moves:** every position has its own fixed dot, and the current one lights up in place. The geometry is built once per round; each beat only toggles classes and moves the gradient's end points.
- Changes fade in opacity over up to 120 ms, never more than a third of a beat, and not at all when notes come faster than 250 ms (or with reduced motion), so the picture never lags behind the sound.
- The tuning values (segment and dot opacities, next-position fill and ring, gradient strength, fade) are CSS variables on `#board`.
- While practicing, the secondary controls (BPM, ticks, round bars, the top corners) step back to lower opacity, and come back on hover or focus; Stop stays as it is.

### 13.4 Texts

Texts in `strings.js`, for every language: fretboard, neck zone, first fret, last fret, the zone note, Done, and the fretboard's accessible label.

## 14. First-use guide

A short guided tour that explains the unlabeled controls where they are.

**When it shows**
- Automatically on the first load, and once for users who already have saved settings. Finishing or skipping it marks it as seen (`guideSeen` in `scaleWalkLight`).
- A small, muted **?** button in the top-right corner, left of the language selector, opens it again.
- Never while practice is running: the **?** is disabled then, like the key and fretboard buttons.

**How it looks**
- The screen dims except for a rounded cutout around the step's control.
- A bubble next to it (below, or above if it does not fit) with a title, one or two sentences, progress dots, **Skip** and **Next** (**Done** on the last step).
- Tapping outside does nothing. `Esc` closes it (counts as seen). Keyboard shortcuts are off while it is open. Focus moves to the bubble and returns to the **?** when opened from it.

**Steps** (Spanish shown; English and Basque say the same)

| # | Points at | Text |
| --- | --- | --- |
| 0 | Language selector | **Idioma:** elige el idioma de la guía y de la app; puedes cambiarlo después arriba a la derecha. The bubble has one button per language, each written in its own language (English · Español · Euskara), the current one highlighted; tapping one switches the whole app at once. |
| 1 | The pick / note | **Una ronda:** una nota al azar de la tonalidad. Tras unos clics de preparación, subes una octava y vuelves a bajar al ritmo del metrónomo. |
| 2 | Setup button | **Ejercicio y tonalidad:** elige el ejercicio: recorrido de escala o formas pentatónicas. Luego sus tonalidades, o la tonalidad y la forma. |
| 3 | Eye | **Ayudas:** toca el ojo para cerrarlo poco a poco, de más ayuda a menos. Below the text, the four eyes with their level: *Todas las notas · Solo la actual · Solo la forma · Solo el inicio*. |
| 4 | Guitar | **Diapasón:** muestra el recorrido en el mástil, dentro de la zona de trastes que elijas. |
| 5 | **?** | **Ayuda:** con **?** vuelves a ver esta guía cuando quieras. |

The language step comes first so the rest of the guide is read in the chosen language. It only appears on the automatic first showing; reopening with **?** starts at step 1.

Tempo, ticks and installing on the phone are left out on purpose.

**Texts** in `strings.js`, for every language: the guide's name, Skip, Next, Done, the step counter, a title and text per step, and `langName`, each language's name written in that language.

## 15. Pentatonic shapes

**Status: phases 1 and 2 built (v3).** The five shapes in any minor key. Phase 3 (moving between shapes) is outlined at the end and not decided.

Goal: memorize the five minor pentatonic shapes as **physical patterns**: where each one sits on the neck and how the hand moves through it. It is not Scale walk with five notes: each shape is a fixed, predefined fingering, the same every time.

### 15.1 Exercises and setup

- **Two exercises:** *Scale walk* (everything in §3, §12 and §13) and *Pentatonic shapes*. Switching exercise feels like changing the activity, not the app: same screen, same controls.
- **Selector inside the setup panel:** the top-left button opens one panel whose first row is the exercise (*Scale walk · Pentatonic*); below it, that exercise's setup. For Scale walk, the key panel as it is (§12). For Pentatonic, the 12 minor keys as tiles (circle-of-fifths order: A E B F♯ C♯ G♯ D♯ B♭ F C G D, one always selected), then the five shapes as tiles, each with a small diagram of the shape and its fret range in that key, and, only when the key and shape fit in two places, a **Variant** choice between them: *Open (0–3) · Closed (12–15)* for the open-position ones, with a one-line hint ("Same shape, with open strings."), or *Low (1–4) · High (13–16)* for two movable octaves. A variant is the same shape, never a different shape number. No new button in the top bar.
- **Button label:** Scale walk as in §12 ("C major", "C, G", "n keys"); Pentatonic "A minor · Shape 1". One key per session: no automatic key changes between rounds.
- **Shared:** BPM, prep and wait ticks, the eye, language and guide. **Per exercise:** Scale walk keeps keys, order, fretboard on/off and zone; Pentatonic keeps its key and shape.
- **Fretboard button:** shown only in Scale walk. In Pentatonic the fretboard is always on: it is the exercise.
- The exercise and the shape can only be changed while stopped, like the keys.
- Storage: `scaleWalkLight` holds `exercise` (`"walk"` | `"penta"`, default `"walk"`), `pentaShape` (1–5, default 1), `pentaKey` (index of the minor key, default A minor) and `pentaPlace` (the chosen placement per key and shape, as its first fret, only where there is a choice).

### 15.2 The shapes

- **Convention:** the common five-box numbering for the minor pentatonic. **Shape 1** has the root on the 6th string under the first finger; shapes 2–5 follow up the neck, each starting where the previous one ends, and shape 5 connects back to shape 1 an octave up. This is not the CAGED naming, which labels the same boxes differently; the two are never mixed.
- Standard tuning (E A D G B e). Reference key: **A minor** (A C D E G; degrees 1 ♭3 4 5 ♭7). Phase 1 uses the five shapes in their canonical A minor positions; shape 5 takes its lowest one.

| Shape | Frets | Ascending sequence (string + fret, low E → high e) | Starts on |
| --- | --- | --- | --- |
| 1 | 5–8 | E5 E8 · A5 A7 · D5 D7 · G5 G7 · B5 B8 · e5 e8 | A (1) |
| 2 | 7–10 | E8 E10 · A7 A10 · D7 D10 · G7 G9 · B8 B10 · e8 e10 | C (♭3) |
| 3 | 9–13 | E10 E12 · A10 A12 · D10 D12 · G9 G12 · B10 B13 · e10 e12 | D (4) |
| 4 | 12–15 | E12 E15 · A12 A15 · D12 D14 · G12 G14 · B13 B15 · e12 e15 | E (5) |
| 5 | 2–5 | E3 E5 · A3 A5 · D2 D5 · G2 G5 · B3 B5 · e3 e5 | G (♭7) |

- **Data:** each shape is defined explicitly, not generated, as its ascending list of `[string, fret]`, in `js/theory.js`. Note, MIDI pitch, note name (spelled like the relative major) and degree are derived from it.
- **Validated by tests:** every note is in A minor pentatonic; two notes per string on all six strings; each note higher than the previous one; the hand span is at most 5 frets; the table above holds.
- **Other keys:** the same shape, every fret moved by the key's interval from A, so its geometry, strings, sequence and degrees stay the same. Every shape fits in every key (60 of 60) between fret 0 and fret 16.
- **Placement:** by default, the **lowest movable** one (no open string, every fret ≥ 1); A minor keeps the positions in the table (shape 4 stays at 12–15). Nine combinations fit in two places, an octave apart, and the user can choose:
  - **Open position**, in five: E minor shape 1, D minor shape 2, C minor shape 3, A minor shape 4 and G minor shape 5 (lowest fret 0). Same geometry measured from the nut, with open strings instead of the first finger: the classic open-position pentatonics, close to the open chords.
  - **Two movable octaves**, in the other four (e.g. 1–4 and 13–16).
  - The choice is remembered per key and shape. A shape that did not fit would be shown disabled, never adjusted.
- **Note names** follow the relative major as the app spells it (§3): A minor like C major, D♯ minor like F♯ major, B♭ minor like D♭ major, and so on.

### 15.3 A round

1. **Announce:** the shape's first (lowest) note, shown and played once as a reference.
2. **Prep:** the shared prep ticks.
3. **Shape:** the complete six-string shape, one position per tick: 12 positions up, then the same 11 back down, without playing the highest twice (23 ticks). Each tick plays the position's real pitch (`OPEN_MIDI[string] + fret`), with the same clicks as Scale walk.
4. **Wait:** the shared wait ticks, then the same shape again.

The route never changes between rounds: no randomness in fingering or starting point.

### 15.4 Display

- **While idle:** the selected shape drawn on the fretboard instead of the pick: every position of the route, the roots marked, nothing lit. The phase line reads "A minor · Shape 1 · Frets 5–8".
- **While practicing:** exactly the Scale walk fretboard (§13.3): no big letter; the current position lit in gold; the next move as a faint gradient; played positions dimmer than upcoming ones; nothing moves; fades follow the tempo. The phase line reads "A minor · Shape 1 · Ascending", with the variant added when there is a choice ("E minor · Shape 1 · Open · Ascending").
- **Open strings** (open variant): drawn as hollow dots, and the nut a little stronger.
- **Roots:** the positions that are the key's root (A in A minor) carry a subtle mark (a thin second ring), always, so the shape can be anchored to its root.
- **Fret range:** the shape's own frets, widened to at least 5 so every shape has the same geometry (extra fret above; below if that would pass fret 16).
- **Aids (eye):** as in Scale walk (§3): all notes, current note, shape only, start only. The idle preview follows level 1 (all positions named) or shows the plain route at the other levels.

### 15.5 Implementation order

1. **Generalize the round's length.** Today the code assumes 15 ticks with the turnaround after 8 (the `WALK` constant and fixed `8` / `14 - i` in the scheduler, phase line, progress bars, fretboard and dev mode). Each round carries its own length and turnaround instead. No visible change: Scale walk must behave exactly the same.
2. **Shapes in `js/theory.js`**, with their tests (§15.2).
3. **The exercise in the app:** setup panel with the exercise row and shape tiles, idle preview, the round, roots, storage and texts in every language. The dev mode follows the round's length, so it can step through a shape.
4. **Any minor key:** key tiles, transposition and naming (§15.2), with their tests.

### 15.6 Along the neck

Learn the move from one shape to the next, not only each shape on its own.

- **A switch in the Pentatonic setup:** *Move along the neck*, off by default. Stored as `pentaNeck`.
- **Off:** as before, the selected shape again and again.
- **On:** practice starts on the selected shape and each round moves to its **neighbour on the neck** in that key, up to the highest shape and back down, back and forth until Stop. The order follows the frets, not the shape numbers: in A minor, 5 (2–5) → 1 → 2 → 3 → 4 (12–15) and back. Each shape uses its chosen variant (§15.2), so an open variant sits at the bottom end. No arbitrary jumps between shapes: those belong to improvisation (§11).
- **Continuous:** the prep ticks and the reference note only before the first shape; no wait ticks between shapes. Each shape ends on its lowest note, on the 6th string, and the next one starts on the 6th string too: the move is a slide along the low string to the next box.
- **Ticks after** has no effect in this mode, so its control is shown disabled while it is on (Pentatonic with *Move along the neck*); it is enabled again otherwise.
- **The next shape is announced** on the phase line during the descent: "A minor · Shape 2 · Descending · Next: Shape 3".
- **Fretboard:** each shape shows its own zone, so the view jumps to the next zone when the next shape starts. An animated slide between zones may come later, after trying this.

### 15.7 Later phase (not decided)

- **Phase 3, moving between shapes:** shapes in one key share notes with their neighbours, so a route across two or more shapes can be built from the same position data. Nothing in phases 1–2 may prevent it.

### 15.8 Texts

In `strings.js`, for every language: the two exercise names, "Move along the neck", "Next: Shape n", "Exercise", "Key" (for the minor keys), "Shape", the shape label ("Shape n"), the minor key name ("A minor"), the fret range ("Frets a–b"), and the accessible labels for the shape tiles and the idle preview.

## Appendix A. Design notes

Why some rules are the way they are. This is background, not behavior: §1–§14 describe the app.

**Origin.** The app started as a single working HTML file, iterated as v1–v5 (all in the `main` history), then grew the PWA, languages, several keys, the fretboard and the guide. Releases are tagged (`v1.0.0`, `v2.0.0`, …).

**Why a fretboard zone needs at least 5 frets (§13.1).**
- A walk is turned into fingering by giving each of its 8 pitches a string and fret inside the zone, never moving to a lower string while ascending; the descent is the same path reversed.
- In standard tuning, a **4-fret zone** covers 4 semitones per string while strings are 5 apart (4 between G and B), so some pitch is always out of reach. Only **26 of the 84** (key × start note) walks fit, wherever the zone is. In frets 5–8 there is no walk at all for D, A, E, F♯, B or D♭ major.
- With **5 frets or more**, all 84 fit, anywhere on the neck. Inside 5 frets there are usually one or two string-monotone fingerings per walk, and they are the usual scale shapes (e.g. C from E8: `E8 E10 A7 A8 A10 D7 D9 D10`).

**Why start notes rotate per key (§3).** The first rule only avoided repeating the previous round's degree, compared across keys. With one key it allowed A–B–A–B patterns and long droughts; with several it could repeat a key's last start note, or start two rounds in a row on the same note in different keys.

**Why nothing slides on the fretboard (§13.3).** The current note used to slide between positions over 160 ms, along with a moving next-note circle and an arrow. At high tempo (200 ms per note at 300 BPM) it was never still and lagged behind the sound.
