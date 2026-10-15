# Scale Trainer

[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-misan128-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/misan128)

Guitar scale trainer: metronome-driven scale walks from a random note, in any major key. Static web app, no dependencies.

**Use it:** https://misan128.github.io/scale-trainer/

## How a round works

1. **Announce** — a random note from the round's key is shown and played once as a reference. It is never the same as the previous round's.
2. **Prep** — a few metronome clicks to get ready.
3. **Walk** — 15 ticks, one note per tick: 8 notes up to the octave and 7 back down. Each note is played with a plucked-string sound.
4. **Wait** — a few more clicks, then the next round starts.

With several keys selected, each round uses one of them; the key is shown above the note, and the wait ticks announce the next one.

Practice keeps going until you stop it.

## Settings

- **BPM**: 30–300.
- **Ticks before / after the walk**: 1–16 and 0–16.
- **Keys** (top-left): pick one or more of the 12 major keys, ordered by the circle of fifths. With several, rounds go in random order (each key once before any repeats) or in circle-of-fifths order. Can only be changed while stopped.
- **Show every note of the walk** (eye beside the keys): closed shows only the start note; open shows each note as it is played.
- **Fretboard** (guitar beside the eye): shows each walk on the fretboard, inside a neck zone you choose (first and last fret, at least 5 frets; standard tuning). Every walk has one fixed fingering — the same key, start note and zone always give the same one — and the notes you hear match the marked frets. With the eye open you see the whole path and the current position moving; with it closed, only the start position. Can only be changed while stopped.
- **Language** (top-right): English, Spanish or Basque.

A short guide explains the controls on first use; tap **?** (top-right) to see it again.

Settings are saved in the browser.

## Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Start / stop |
| `↑` / `↓` | BPM ±1 |
| `Shift` + `↑` / `↓` | BPM ±5 |

## Install on iPhone

1. Open https://misan128.github.io/scale-trainer/ in Safari.
2. Tap **Share → Add to Home Screen**.
3. Open it from the home screen icon. It runs full screen and works offline after the first load.

The screen stays on while practice is running. It plays even with the phone on silent (iOS 17 or later).

## Install on Android

1. Open https://misan128.github.io/scale-trainer/ in Chrome.
2. Tap the **⋮** menu → **Install app** (or **Add to Home screen**). Chrome may also offer it on its own.
3. Open it from the app icon. It runs full screen, appears in the app drawer and works offline after the first load.

The screen stays on while practice is running. Sound follows the media volume.

## Running it locally

Open `index.html` in a browser. There is no build step and nothing to install. Offline support needs the site to be served over HTTP(S), not opened as a file.

## License

[MIT](LICENSE)
