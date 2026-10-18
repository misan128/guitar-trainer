# Scale Trainer

[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-misan128-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/misan128)

Guitar practice with a metronome, on the fretboard: scale walks from a random note in any major key, and the five minor pentatonic shapes in any minor key. Static web app, no dependencies.

**Use it:** https://misan128.github.io/scale-trainer/

## Two exercises

Choose the exercise in the setup panel (the button at the top left). BPM, ticks, aids and language are shared.

### Scale walk

1. **Announce** — a random note from the round's key is shown and played once as a reference. Each key goes through all seven start notes before repeating one, and two rounds in a row never start on the same note.
2. **Prep** — a few metronome clicks to get ready.
3. **Walk** — 15 ticks, one note per tick: 8 notes up to the octave and 7 back down. Each note is played with a plucked-string sound.
4. **Wait** — a few more clicks, then the next round starts.

- **Keys:** one or more of the 12 major keys (at least one stays selected; Clear goes back to C major), ordered by the circle of fifths. With several, rounds go in random order (each key once before any repeats) or in circle-of-fifths order; the key is shown with the round, and the wait ticks announce the next one.
- **Fretboard** (guitar beside the eye): shows each walk on the fretboard, inside a neck zone you choose (first and last fret, at least 5 frets; standard tuning). Every walk has one fixed fingering — the same key, start note and zone always give the same one — and the notes you hear match the marked frets. On by default, frets 2–6.

### Pentatonic shapes

The five minor pentatonic shapes, played as fixed fingering patterns to build muscle memory. Shape 1 has the root on the 6th string under the first finger; shapes 2–5 follow up the neck.

- **Key:** any of the 12 minor keys. The shape keeps its geometry and moves along the neck, with its notes spelled after the key signature.
- **Shape:** 1 to 5, each tile with a small diagram and its frets. The selected shape is shown on the fretboard before you start, with its roots marked.
- **Variant:** when a shape fits in two places, choose between them: *Open* or *Closed* for the five open-position ones (E minor shape 1, D minor 2, C minor 3, A minor 4, G minor 5), *Low* or *High* for two octaves of the same movable shape.
- **A round:** the complete six-string shape up (12 notes) and back down (11), then the same shape again straight away, without stopping. The reference note and the prep ticks only come before the first round, and there are no wait ticks: the route never changes, so there is nothing to wait for.
- **Move along the neck:** instead of repeating one shape, each round moves to the next shape up the neck, and back down at the end, without stopping. As with one shape, it doesn't stop between shapes, and the next shape is announced while you descend: you slide along the 6th string into the next box. On the fretboard, a bar under the fret numbers shows where you are on the neck and, on the way down, points to the next shape; on the last note the view slides there.

Practice keeps going until you stop it.

## Tuner

The tuning fork (top-right) opens the tuner. Play a string: it shows the nearest note and a needle from flat to sharp, gold when it is in tune (within the band of ±5 cents, A = 440 Hz). When the string fades, its note stays dimmed for a second and a half, then fades out. A thin bar shows how loud the microphone hears the guitar. It uses the microphone only while it is open, and nothing is recorded or sent. Choose the tuning: *Standard*, *½ step down*, *Drop D* or *e → D* (standard with the high e down to D). Below, its six open strings play their pitch when tapped, to tune by ear; they work without the microphone too.

## Settings

- **BPM**: 30–300.
- **Ticks before / after the walk**: 1–16 and 0–16.
- **Aids** (the eye): how much the fretboard shows, from more help to less. Each tap closes the eye one step: *all notes* named → only the *current note* named → the *shape* without names → only the *start* position, to play the rest from memory. Wide open by default.
- **Language** (top-right): English, Spanish or Basque.

The exercise, keys, shape and fretboard can only be changed while stopped. A short guide explains the controls on first use; tap **?** (top-right) to see it again.

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

There is no build step. Serve the folder and open it in a browser:

```sh
npm start                      # then open http://localhost:8000/
```

It needs only Node. Opening `index.html` as a file does not work: the app is made of ES modules, which browsers load only over HTTP(S).

## Testing

```sh
node --test                    # unit tests: Node 18+, no dependencies
npm install && npm run smoke:setup   # once, for the smoke tests (Playwright and Chromium)
npm run smoke                  # the main flows in a real browser
```

The unit tests check start-note selection, every fretboard walk, the five pentatonic shapes in every key, and that all languages have the same texts. The smoke tests run the app in Chromium. What they cover, and a manual checklist for the phone, are in [docs/TESTING.md](docs/TESTING.md).

## License

[MIT](LICENSE)
