# Wingits

Soft, transparent desktop widgets for Windows. Open the Wingits window, drag a widget onto the desktop preview, and it appears as a floating, borderless, rounded card on your real desktop — drag it anywhere.

## Download

Grab the latest installer from the [**Releases** page](../../releases/latest):

| File | What it is |
| --- | --- |
| `Wingits-Setup-x.y.z.exe` | One-click installer (per-user, no admin needed) |
| `Wingits-Portable-x.y.z.exe` | Single portable executable, no install |

> The builds are not code-signed, so Windows SmartScreen may show "Windows protected your PC" — choose **More info → Run anyway**.

No release yet? Open **Actions → Build & Release → Run workflow**, then download the `Wingits-windows` artifact from the finished run.

## Widgets

| Widget | Notes |
| --- | --- |
| **Date & Time** | Large light typography; double-click to switch 12/24-hour |
| **Weather** | Live conditions from [Open-Meteo](https://open-meteo.com) (no API key) with looping scenes: drifting clouds, rain, snow, fog, thunderstorms, sun and moon. Auto-locates by IP, or set a city |
| **To-Do** | Add, tick off and delete tasks. Each task pays out XP **once** |
| **Companion** | A pixel cat, slime or plant linked to the To-Do list — finishing a task gives XP, hearts and a hop; levelling up adds a bow tie, crown and wings (the plant simply grows taller and blooms). Click it to pet it |
| **Pomodoro** | Focus / short / long break ring timer with chime and notification; survives restarts |
| **Countdown** | Days (and hours) until an event; click to edit |
| **Sticky Note** | Autosaving, five pastel colors. Add as many as you like |
| **Music** | Mini player with album art (read from ID3 tags), progress, prev/next. Drop audio files onto it or press **+** |
| **System** | Soft circular CPU and RAM dials |

## Using it

* **Add** – drag a card from the library onto the desktop preview (it lands at the matching spot on your screen) or press **+**.
* **Move** – drag a tile in the preview, or drag the widget itself on your desktop.
* **Remove** – hover a widget and press **×**.
* **Style** – dark/light glass and transparency apply to every widget live.
* Closing the main window keeps Wingits running in the system tray (right-click it to hide widgets or quit). Layout, tasks, notes, XP and timers are saved automatically in `%APPDATA%/Wingits/wingits-state.json`.

## Development

```bash
npm install
npm start          # run the app
npm run dist       # build installers into dist/ (run on Windows)
npm run icon       # regenerate build/icon.png
```

Releases are built by GitHub Actions: push a tag such as `v0.1.0` and the installers are attached to the release automatically.

```
src/main/        main process: windows, tray, state store, weather, system stats, ID3 reader
src/preload.js   the narrow, sandboxed API exposed to the UI
src/shared/      widget registry + XP maths
src/renderer/    dashboard UI and one small module per widget (widgets/types/*.js)
```

### Adding a widget

1. Add an entry to `src/shared/registry.js` (name, icon, size).
2. Create `src/renderer/widgets/types/<name>.js` calling `Wingits.register('<name>', ctx => { … })`. `ctx` gives you a root element, per-widget storage (`inst()` / `setInst()`) and the shared `state`.
3. Add any styles to `src/renderer/widgets/types.css`.

## Known limitations

* Widgets are ordinary always-below-apps windows, not part of the desktop itself, so **Win + D** (Show desktop) may hide them. Enable **Keep widgets on top** if you want them always visible.
* The music widget plays files you give it; it does not read what other apps (Spotify, etc.) are playing.
* Windows only has been designed for; Linux/macOS builds are untested.

## License

MIT
