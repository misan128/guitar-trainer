# Scale Trainer — Specification

## 1. Context

A small tool to practice guitar scales **now**, while a much larger project is developed separately. This repository is independent of that project. Nothing from it should be anticipated here.

**Scope is closed.** The tool is finished at §14: no new features. Only fixes, polish and tests from here on.

**Guiding principle:** get it working and in use as soon as possible. When in doubt, pick the simplest option. If something is not decided in this document, **ask the user before making it up** (see §9).

## 2. Starting point

- The app started as a single working HTML file (v1–v5, all in the `main` history). This document describes what it is now.
- §3 is the core behavior; §5, §6 and §12–§14 build on it and say explicitly where they change it.
- No migration to frameworks, bundlers or TypeScript. It stays HTML + CSS + JS with no build step.

## 3. Core behavior

This section is for understanding the code and checking that nothing breaks.

**Round:**
1. **Announce:** a random note from the round's key (see §12), different from the previous round's. It is shown on screen and played once as a reference.
2. **Prep:** *n* normal clicks (1–16, default 4).
3. **Walk:** 15 ticks, one note per tick: 8 notes up to the octave and 7 back down. Each tick plays the note (Karplus-Strong) with a soft click. The first walk tick has an accented (soft) click, and each note is muted when the next one arrives.
4. **Wait:** *m* normal clicks (0–16, default 4). Then a new round starts.
5. Practice continues until the user stops it. Nothing is recorded.

**Settings:**
- BPM from 30 to 300 (default 60).
- BPM controls, built for thumbs: the slider has a 48px touch area around a 7px bar (gold progress) and a 27px thumb; tapping anywhere on it jumps there, then it drags (handled in JS, since iOS only drags the thumb natively), and it never scrolls the page. On `−`/`+` (all steppers), a press steps once and holding repeats until release, with mouse or touch; the click a press leaves behind is ignored so a tap never counts twice. Slider, number and buttons stay in sync, also while running.
- Ticks before and after the walk.
- Keys: one or more of the 12 major keys, ordered by the circle of fifths and spelled after their key signature. Can only be changed while stopped. The selector sits in the top-left corner in brass (see §12).
- "Show every note of the walk": off, only the start note is shown; on, each note's name is shown on its tick. **On by default** (same reasoning as the fretboard, §13.2); a saved choice is kept. It is an unlabeled eye toggle to the right of the key selector, on the same line (closed and muted = off; open on a brass-tinted tile = on), usable while running.
- Settings are saved in `localStorage` under the key `scaleWalkLight`. **Keep that key** so the user's settings are not lost.
- With a single key selected, everything in this section behaves exactly as before §12.

**Screen:**
- While idle, an animated SVG pick is shown. On start it disappears and the note appears centered, in brass. On stop the pick comes back.
- A round progress bar is always visible.
- A phase line shows the key, the current step (prep, ascending, descending or wait) and the countdown.

**Audio:**
- With the fretboard off, the start note always plays in octave 3. With it on, the zone decides the octave (§13.3).
- The scheduler uses lookahead over `AudioContext.currentTime`, and the UI syncs with `requestAnimationFrame`, subtracting `outputLatency`.

**Shortcuts:** `Space` starts or stops; `↑`/`↓` add or subtract 1 BPM; with `Shift`, 5.

## 4. Repository

### 4.1 Commits
- Branch `main`. Existing history is not rewritten.
- Small commits following [Conventional Commits](https://www.conventionalcommits.org/), in English, using the `/conventional-commits` skill.

### 4.2 Files
```
index.html
strings.js
theory.js
manifest.webmanifest
sw.js
icons/
tests/
docs/SPEC.md
docs/TESTING.md
README.md
LICENSE
.gitignore
```

- **`.gitignore`:** system files, editors, `node_modules/`, logs, `*.zip`, AI agent directories and the loose versions folder (`.tmp/`).
- **`LICENSE`:** MIT, held by Michael Sandoval.
- **`README.md`:** in English. Describes **only what exists**: what the app does, what a round looks like, settings, shortcuts, how to install it on iPhone and Android, and a link to the published site. No roadmap or promises.
- **`theory.js`:** scale theory and fretboard walks (§13.3), with no DOM, so the tests can load it. In the browser it defines `Theory`; in Node it is a CommonJS module.
- **`tests/`:** run with `node --test` from the repo root (Node 18+, no dependencies). They check every fretboard walk against acceptance criterion 11, known fingerings, scale spelling, and that every language has the same texts.
- **`docs/TESTING.md`:** how to run the tests, run the app locally, and the manual checklist for the phone.
- **`docs/SPEC.md`:** this document. Describes state and decisions, not one-off steps.
- **Repo description** (GitHub "About" field, set by the user): *Guitar scale trainer: metronome-driven scale walks from a random note, in any major key. Static web app, no dependencies.*

## 5. Language and texts

- **Code in English:** comments, identifiers and commit messages.
- **UI texts centralized in `strings.js`:** one object per language (`en`, `es`, `eu`) with the same keys. Covers everything visible or read by screen readers: labels, buttons, phases, shortcut hint, `aria-label` and `<title>`. Note and key names (C, D♭, F♯…) are not translatable text.
- Loaded with `<script>` before the app code. No build, no `fetch`.
- **Language selector:** small and subtle in the top-right corner, showing the language code (EN / ES / EU). Saved in `localStorage` inside `scaleWalkLight` (new `lang` field), without breaking previously saved settings.
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

### 6.3 Tags in `index.html`
- `<link rel="manifest">`, `<link rel="apple-touch-icon">`, `<meta name="theme-color">`.
- `apple-mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style` (`black-translucent`, consistent with the current use of `safe-area-inset`).
- `apple-mobile-web-app-title`: Scale Trainer.
- Service worker registration.

### 6.4 Service worker
- Precaches `index.html`, `strings.js`, `theory.js`, the manifest, the icons and the fonts.
- Fonts are self-hosted in `fonts/` (latin subsets, OFL); the app makes no third-party requests.
- The cache name is versioned (`scale-trainer-v1`, etc.). Old caches are deleted on activate. **Every published change bumps the version.**
- Strategy for app files (`index.html`, `strings.js`, …): network first, falling back to cache, so updates arrive without reinstalling.

### 6.5 Mobile behavior
- **Wake Lock:** keep the screen on while practice is running. Released on stop, and requested again if the page returns to the foreground with practice running. If the API does not exist, it is silently ignored.
- **Background:** if the app goes to the background while running, nothing special happens; the system suspends it.
- **iOS silent switch:** **ignored**. The app is a practice tool, so it plays like a media app: `navigator.audioSession.type = "playback"` is set before creating the audio context (Safari 17+; ignored where the API does not exist).

## 7. Deployment

- **GitHub Pages**, **public** repository, publishing from `main` / root.
- URL: `https://misan128.github.io/scale-trainer/`.
- No GitHub Actions, no build step.

## 8. Work order

Everything in §5–§7 and §12–§14 is built. What is left: fixes found while using it on the phone, small UX polish, and tests (§4.2).

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
9. With one key selected, practice looks and sounds as before §12; with several, every point of §12 holds.
10. With the fretboard off, practice looks and sounds exactly as without §13.
11. With the fretboard on, every walk in every zone of at least 5 frets is playable: each marked fret sounds the pitch played, stays inside the zone, never moves to a lower string while ascending, and the same key, start note and zone always give the same fingering.
12. The first-use guide shows once (language step first), can be reopened with **?**, and is never shown while practice is running.

## 11. Out of scope

Any new practice feature (scope is closed, §1), other scales or modes, tuner, accounts, analytics, frameworks, build, and anything from the larger project.

## 12. Multi-key practice

Asked for by the user's guitar teacher: practice switching between keys, not just walking within one.

**Selection panel** (replaces the native key `<select>`):
- The brass button in the top-left corner opens a dark panel; it follows the app's look, not the browser's.
- 12 toggle tiles in a 3×4 grid, circle-of-fifths order (C G D / A E B / F♯ D♭ A♭ / E♭ B♭ F). Selected tiles are brass with a check mark. A counter shows "n of 12".
- Every tap applies at once; there is no Apply button.
- Quick actions: **All** (left) and **Clear** (right); each is disabled when it would change nothing.
- **At least one key is always selected:** tapping the only selected key does nothing, and **Clear** goes back to C major (disabled when that is already the selection). A saved empty selection falls back to C.
- **Round order:** *Random* (default) or *In order*.
- Closes on tapping outside, on `Esc` or on the button again. Focus moves into the panel and returns to the button on close. Tiles are buttons with `aria-pressed`.
- The button is disabled while practice is running, like the old selector.
- While the panel is open, the keyboard shortcuts (§3) are off.

**Button label:** one key → "C major"; two → "C, G" (circle-of-fifths order); three or more → "n keys".

**Round order:**
- *Random:* shuffle-bag. All selected keys are shuffled into a block and played once each before reshuffling. The first key of a new block is never the last key of the previous one (with two keys this alternates them).
- *In order:* the selected keys in circle-of-fifths order, cycling.
- The key changes only between rounds, at the announce. Practice is endless, as before; there is no round counter.

**Screen while running (several keys selected):**
- The round's key is shown as a label right above the note, smaller than the note. The note stays the dominant element; the eye toggle works as before.
- During the wait ticks, the phase line announces the next key: "Next: D major · 3", so there is time to move on the fretboard.
- With one key selected, the screen is unchanged.

**Storage:** `scaleWalkLight` gains `keys` (array of key indices) and `order` (`"random"` | `"sequential"`). A saved single `key` is migrated to `keys: [key]`.

**Texts:** new keys in `strings.js` for every language: the "n keys" summary, panel title, "n of 12" counter, "All", "Clear", round order and its two options, and "Next: …". Counts are functions (like `keyName`) so each language builds its own plural.

## 13. Fretboard walks

Goal: learn **how to play** each scale walk across the six strings inside a limited fret zone, not just where the notes are. Each walk has one concrete string and fret per note, so it can be memorized and repeated.

Built in phases. **Phase 1 (MVP)** is what this section describes. Later phases (better fingering rules, progressive memorization aids, more validation, mobile polish) are not decided yet.

### 13.1 Analysis (why the rules below)

- Today a round is only pitches: a random degree (never the same twice in a row), the start note in octave 3, 8 pitches up and the same 7 back down. There are no strings or frets.
- Turning it into a fretboard walk means giving each of the 8 pitches a string and fret inside the zone, never moving to a lower string while ascending. The descent is the same path reversed.
- In standard tuning, a **4-fret zone** covers 4 semitones per string while strings are 5 apart (4 between G and B), so some pitch is always out of reach. Only **26 of the 84** (key × start note) walks fit, wherever the zone is. In frets 5–8 there is no walk at all for D, A, E, F♯, B or D♭ major.
- With **5 frets or more**, all 84 fit, anywhere on the neck. Inside 5 frets there are usually one or two string-monotone fingerings per walk, and they are the usual scale shapes (e.g. C from E8: `E8 E10 A7 A8 A10 D7 D9 D10`).

### 13.2 Settings

- **Guitar button** in the top-left corner, right of the eye. Muted when the fretboard is off, a brass tile when on. It opens the **fretboard panel**, styled like the key panel (same open/close, focus and `Esc` rules; only one panel open at a time; shortcuts off while open).
- Panel contents: title "Fretboard" with an on/off **switch**; "Neck zone" with **first fret** and **last fret** selectors; a one-line note saying the walk is shown inside that range; a **Done** button that closes it.
- Zone limits: first fret 0–15, last fret up to 19, and **at least 5 frets** (last ≥ first + 4). Changing the first fret pushes the last one up if needed. Default zone: 2–6 (the part of the neck the user knows best). Fret 0 means open strings.
- No tuning selector until there is more than standard tuning (E A D G B e).
- Like the keys, the button is disabled while practice is running: the fretboard and zone are fixed per session.
- **On by default**, like the eye: aids start on and players turn them off as they need them less; an aid that starts off may never be discovered. Saved settings without `board` (from before §13) also get it on; an explicit saved choice is kept.
- Storage: `scaleWalkLight` gains `board` (bool), `fretFrom` and `fretTo`.

### 13.3 Building the walk

- For each round, with the round's key (multi-key practice from §12 works unchanged; the zone stays the same across keys):
  1. **Start note:** random degree as today (never the same twice in a row), but only among degrees with a valid walk in the zone. With ≥5 frets every degree has one.
  2. **Octave:** what you hear must match the marked frets, so the zone decides the octave. Octave 3 is used when the walk fits there (always for zones between 3–7 and 8–12); otherwise the octave whose start is closest to octave 3. This is the one documented change to "the start note always plays in octave 3", and only with the fretboard on.
  3. **Fingering:** among all string-monotone assignments inside the zone, the first by these rules, in order: smallest hand span (highest minus lowest fret), least total fret movement between consecutive notes, fewest string changes, start on the lowest string. The result is deterministic: the same key, start note and zone always give the same walk.
- Every walk is up and down one octave, as today.
- If no walk can be built for a key (not possible with ≥5 frets, but handled), the round is played without the fretboard instead of showing a wrong fingering.

### 13.4 Display

- An SVG fretboard under the note while practice is running with the fretboard on. While idle, the pick shows as before and there is no fretboard.
- Six horizontal strings, high e at the top, labeled e B G D A E; only the zone's frets; fret numbers under each fret; the nut when the zone starts at 0.
- The fretboard **replaces the big note letter** while it shows: the gold dot already names the note. The key goes into the phase line ("C major · Ascending"), also with several keys.
- **Eye open:** the walk's positions joined by a faint brass line, and the **current position in gold** with its note name. During prep and wait the current position is the start note. Other scale notes in the zone are not drawn: the path is what gets memorized.
- With the eye open, the **next move** is hinted, to build muscle memory rather than to be read: the next position stands out (larger, brighter, full brass ring, no name), the segment from the current note to it is drawn in strong brass with a small arrow halfway pointing at it, and the rest of the path is faded to a quiet map. During prep it shows the first step; there is none during the wait.
- **Eye closed:** only the start position, in gold, for the whole round; the rest has to be found by the player. The big note still shows the start note, as today.
- The gold dot moves to the next position on each tick, with a short transition (disabled with reduced motion).

### 13.5 Texts

New keys in `strings.js` for every language: fretboard, neck zone, first fret, last fret, the zone note, Done, and the fretboard's accessible label.

## 14. First-use guide

A short guided tour that explains the unlabeled controls where they are.

**When it shows**
- Automatically on the first load, and once for users who already have saved settings. Finishing or skipping it marks it as seen: `scaleWalkLight` gains `guideSeen`.
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
| 2 | Keys button | **Tonalidades:** elige una o varias, y si las rondas van al azar o en orden. |
| 3 | Eye | **Ver las notas:** abierto, ves cada nota del recorrido; cerrado, solo la inicial, para memorizarlo. |
| 4 | Guitar | **Diapasón:** muestra el recorrido en el mástil, dentro de la zona de trastes que elijas. |
| 5 | **?** | **Ayuda:** con **?** vuelves a ver esta guía cuando quieras. |

The language step comes first so the rest of the guide is read in the chosen language. It only appears on the automatic first showing; reopening with **?** starts at step 1.

Tempo, ticks and installing on the phone are left out on purpose.

**Texts:** new keys in `strings.js` for every language: the guide's name, Skip, Next, Done, the step counter, a title and text per step, and `langName`, each language's name written in that language.
