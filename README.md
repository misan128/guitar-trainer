# Scale Trainer

Guitar scale trainer: metronome-driven scale walks from a random note, in any major key. Static web app, no dependencies.

## How a round works

1. **Announce** — a random note from the selected key is shown and played once as a reference. It is never the same as the previous round's.
2. **Prep** — a few metronome clicks to get ready.
3. **Walk** — 15 ticks, one note per tick: 8 notes up to the octave and 7 back down. Each note is played with a plucked-string sound.
4. **Wait** — a few more clicks, then the next round starts.

Practice keeps going until you stop it.

## Settings

- **BPM**: 30–300.
- **Ticks before / after the walk**: 1–16 and 0–16.
- **Key**: the 12 major keys, ordered by the circle of fifths. Can only be changed while stopped.
- **Show every note of the walk**: off shows only the start note; on shows each note as it is played.
- **Language**: English or Spanish.

Settings are saved in the browser.

## Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Start / stop |
| `↑` / `↓` | BPM ±1 |
| `Shift` + `↑` / `↓` | BPM ±5 |

## Running it

Open `index.html` in a browser. There is no build step and nothing to install.

## License

[MIT](LICENSE)
