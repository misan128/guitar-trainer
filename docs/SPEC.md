# Scale Trainer — Specification

## 1. Context

A small tool to practice guitar scales **now**, while a much larger project is developed separately. This repository is independent of that project. Nothing from it should be anticipated here.

**Guiding principle:** get it working and in use as soon as possible. When in doubt, pick the simplest option. If something is not decided in this document, **ask the user before making it up** (see §9).

## 2. Starting point

- The functional reference is `index.html` at commit `2e9a486` (`style: color note letter brass`), equivalent to v5. The `main` history already covers the v1–v5 evolution.
- Its behavior (§3) **does not change** except where §5, §6 and §12 explicitly say so.
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
- **`README.md`:** in English. Describes **only what exists**: what the app does, what a round looks like, settings, shortcuts, how to install it on an iPhone and a link to the published site. No roadmap or promises.
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

Goal: install it on an **iPhone** from Safari ("Add to Home Screen") and use it offline.

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

## 11. Out of scope

New practice features beyond §12, other scales or modes, tuner, accounts, analytics, frameworks, build, and anything from the larger project.

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

