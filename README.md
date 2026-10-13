# Scale Trainer

[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-misan128-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/misan128)

Guitar scale trainer: metronome-driven scale walks from a random note, in any major key. Static web app, no dependencies.

**Use it:** https://misan128.github.io/scale-trainer/

## How a round works

1. **Announce** — a random note from the selected key is shown and played once as a reference. It is never the same as the previous round's.
2. **Prep** — a few metronome clicks to get ready.
3. **Walk** — 15 ticks, one note per tick: 8 notes up to the octave and 7 back down. Each note is played with a plucked-string sound.
4. **Wait** — a few more clicks, then the next round starts.

Practice keeps going until you stop it.

## Settings

- **BPM**: 30–300.
- **Ticks before / after the walk**: 1–16 and 0–16.
- **Key** (top-left): the 12 major keys, ordered by the circle of fifths. Can only be changed while stopped.
- **Show every note of the walk** (eye under the key): closed shows only the start note; open shows each note as it is played.
- **Language** (top-right): English or Spanish.

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

The screen stays on while practice is running. The silent switch is respected: with the phone on silent, there is no sound.

## Running it locally

Open `index.html` in a browser. There is no build step and nothing to install. Offline support needs the site to be served over HTTP(S), not opened as a file.

## License

[MIT](LICENSE)
