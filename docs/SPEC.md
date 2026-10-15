# Scale Trainer — Specification

## 1. Context

A small tool to practice guitar scales **now**, while a much larger project is developed separately. This repository is independent of that project. Nothing from it should be anticipated here.

**Guiding principle:** get it working and in use as soon as possible. When in doubt, pick the simplest option. If something is not decided in this document, **ask the user before making it up** (see §9).

## 2. Starting point

- The functional reference is `index.html` at commit `2e9a486` (`style: color note letter brass`), equivalent to v5. The `main` history already covers the v1–v5 evolution.
- Its behavior (§3) **does not change** except where §5, §6, §12 and §13 explicitly say so.
- No migration to frameworks, bundlers or TypeScript. It stays HTML + CSS + JS with no build step.

## 3. Current app behavior (do not change)

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
- "Show every note of the walk": off, only the start note is shown; on, each note's name is shown on its tick. It is an unlabeled eye toggle to the right of the key selector, on the same line (closed and muted = off; open on a brass-tinted tile = on), usable while running.
- Settings are saved in `localStorage` under the key `scaleWalkLight`. **Keep that key** so the user's settings are not lost.
- With a single key selected, everything in this section behaves exactly as before §12.

**Screen:**
- While idle, an animated SVG pick is shown. On start it disappears and the note appears centered, in brass. On stop the pick comes back.
- A round progress bar is always visible.
- A phase line shows the key, the current step (prep, ascending, descending or wait) and the countdown.

**Audio:**
- The start note always plays in octave 3.
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
manifest.webmanifest
sw.js
icons/
docs/SPEC.md
README.md
LICENSE
.gitignore
```

- **`.gitignore`:** system files, editors, `node_modules/`, logs, `*.zip`, AI agent directories and the loose versions folder (`.tmp/`).
- **`LICENSE`:** MIT, held by Michael Sandoval.
- **`README.md`:** in English. Describes **only what exists**: what the app does, what a round looks like, settings, shortcuts, how to install it on iPhone and Android, and a link to the published site. No roadmap or promises.
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
- Precaches `index.html`, `strings.js`, the manifest, the icons and the fonts.
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

1. Texts: code in English, `strings.js` with `en`/`es` and language selector (§5).
2. PWA (§6).
3. Publishing: README, LICENSE and GitHub Pages (§4.2, §7).
4. UX tweaks, only if testing on the phone calls for them.

## 9. Pending confirmation from the user

Nothing pending right now. Add here anything that comes up and needs the user's decision.

## 10. Acceptance criteria

1. §3 behavior is identical to v5, in both languages.
2. No UI text remains outside `strings.js`, and switching language changes every text.
3. The site published on GitHub Pages loads correctly from the subdirectory.
4. On iPhone (Safari) it can be added to the home screen with the correct name and icon, and it opens full screen.
5. After a first load, it opens and works in airplane mode, fonts included.
6. While practice is running, the screen does not turn off.
7. After publishing a change and bumping the cache version, the installed app picks it up when reopened.
8. Settings saved with v5 are preserved.
9. With one key selected, practice looks and sounds as before §12; with several, every point of §12 holds.
10. With the fretboard off, practice looks and sounds exactly as without §13.

## 11. Out of scope

New practice features beyond §12 and §13, other scales or modes, tuner, accounts, analytics, frameworks, build, and anything from the larger project.

## 12. Multi-key practice

Asked for by the user's guitar teacher: practice switching between keys, not just walking within one.

**Selection panel** (replaces the native key `<select>`):
- The brass button in the top-left corner opens a dark panel; it follows the app's look, not the browser's.
- 12 toggle tiles in a 3×4 grid, circle-of-fifths order (C G D / A E B / F♯ D♭ A♭ / E♭ B♭ F). Selected tiles are brass with a check mark. A counter shows "n of 12".
- Every tap applies at once; there is no Apply button.
- Quick actions: **All** (left) and **Clear** (right); each is disabled when it would change nothing.
- The selection may be empty: the button then reads "Choose keys" and Start is disabled. An empty selection is not restored on reload; it falls back to C.
- **Round order:** *Random* (default) or *In order*.
- Closes on tapping outside, on `Esc` or on the button again. Focus moves into the panel and returns to the button on close. Tiles are buttons with `aria-pressed`.
- The button is disabled while practice is running, like the old selector.
- While the panel is open, the keyboard shortcuts (§3) are off.

**Button label:** none → "Choose keys"; one key → "C major"; two → "C, G" (circle-of-fifths order); three or more → "n keys".

**Round order:**
- *Random:* shuffle-bag. All selected keys are shuffled into a block and played once each before reshuffling. The first key of a new block is never the last key of the previous one (with two keys this alternates them).
- *In order:* the selected keys in circle-of-fifths order, cycling.
- The key changes only between rounds, at the announce. Practice is endless, as before; there is no round counter.

**Screen while running (several keys selected):**
- The round's key is shown as a label right above the note, smaller than the note. The note stays the dominant element; the eye toggle works as before.
- During the wait ticks, the phase line announces the next key: "Next: D major · 3", so there is time to move on the fretboard.
- With one key selected, the screen is unchanged.

**Storage:** `scaleWalkLight` gains `keys` (array of key indices) and `order` (`"random"` | `"sequential"`). A saved single `key` is migrated to `keys: [key]`.

**Texts:** new keys in `strings.js` for every language: the "n keys" summary, "Choose keys", panel title, "n of 12" counter, "All", "Clear", round order and its two options, and "Next: …". Counts are functions (like `keyName`) so each language builds its own plural.

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
- **Eye open:** the other scale notes in the zone as very faint dots, the walk's positions joined by a faint brass line, and the **current position in gold** with its note name. During prep and wait the current position is the start note.
- **Eye closed:** only the start position, in gold, for the whole round; the rest has to be found by the player. The big note still shows the start note, as today.
- The gold dot moves to the next position on each tick, with a short transition (disabled with reduced motion).
- While the fretboard shows, the note gets smaller so everything fits on a phone screen.

### 13.5 Texts

New keys in `strings.js` for every language: fretboard, neck zone, first fret, last fret, the zone note, Done, and the fretboard's accessible label.
