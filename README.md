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

## Updates

Wingits checks GitHub for a newer release each time it starts and then every 5 hours. With **Install automatically** on (the default, installed Windows build only) it downloads the new installer, verifies its SHA-256 checksum, installs it silently and restarts itself. The portable build, or turning that option off, shows a banner with a **Download** button instead. Everything lives under **Updates** in the main window's settings, including **Check now**.

> **The repository must be public for other people's copies to update.** GitHub hides a private repository's releases from anyone who isn't signed in, so an unauthenticated app gets a "not found". Wingits now says so in the banner instead of silently reporting "up to date". Using a token is entirely optional: if you keep the repo private you can choose to paste a GitHub personal access token (read access to the repo's contents) into **Updates → GitHub token**; it is stored only in your local settings file and is never shown to the widgets.

## Blurred glass

Widget cards blur your desktop wallpaper behind them (lined up with where each card sits). The **Transparency** slider controls how much of it shows through. It blurs the wallpaper only, not other windows that happen to be underneath.

## Timer bar

While a Pomodoro timer is running or paused, a small pill at the bottom of the screen shows the time with an icon (target = focus, stopwatch = break). Hover it to reveal pause/resume, stop and × (hides the bar until the timer is started again). Turn it off under **Behavior → Timer bar on screen**.

## Developer mode

Turn on **Developer → Dev mode** in the main window to experiment with things that aren't normally available: jump the pet to any level (e.g. 50 for the apple tree), fake the time of day (cat bedtime, clock) or the weather, disable all animations, unlock the widget size limits, use 10-second Pomodoros, trigger grooming / falling apples / hearts, and add or complete tasks instantly.

Nothing done in dev mode is saved. Turning it off restores everything — settings, pet, tasks, notes, widget layout and sizes — exactly as it was when you turned it on, and quitting while it's on leaves your saved data untouched.

## Widgets

| Widget | Notes |
| --- | --- |
| **Date & Time** | Large light typography. 24-hour or 12-hour (AM/PM) under **Style → Time format**, or double-click the widget |
| **Weather** | Live conditions from [Open-Meteo](https://open-meteo.com) (no API key) with looping scenes: drifting clouds, rain, snow, fog, thunderstorms, sun and moon. Auto-locates by IP, or set a city |
| **To-Do** | Add, tick off and delete tasks; finished tasks sink to the bottom of the list. Each task pays out XP **once** |
| **Companion** | A hi-res pixel cat, slime or plant linked to the To-Do list — finishing a task gives XP, hearts and a hop; levelling up adds a bow tie, crown and wings. The cat has a thin, endlessly varied swishing tail, grooms itself every 30–90 s, and from 22:00 to 07:00 walks to its bed (which slides to the middle while it sleeps) and naps with floating z's. Click it for hearts (one batch per 3 s) and sometimes a speech bubble ("Meow" / "-no thoughts-"; click it to shuffle, it fades after 5 s). The plant grows bigger at levels 2, 5, 10, 25 and 50 — at 50 it becomes an apple tree whose apples fall into a wooden bin that slides over to catch them |
| **Pomodoro** | Focus / short / long break ring timer with chime and notification; survives restarts |
| **Countdown** | Days (and hours) until an event; click to edit |
| **Sticky Note** | Autosaving, five pastel colors. Add as many as you like |
| **Now Playing** | Shows whatever Windows is playing — Spotify, YouTube in your browser, VLC, Apple Music, media files in most players — with big album art, title/artist, a progress bar and a live visualizer driven by your system audio. Display only (no buttons) and no background; text floats on your wallpaper. If a player supplies no artwork, it is looked up from the iTunes catalogue by artist and title |
| **System** | Soft circular CPU and RAM dials |

## Using it

* **Add** – drag a card from the library onto the desktop preview (it lands at the matching spot on your screen) or press **+**.
* **Move** – drag a tile in the preview, or drag the widget itself on your desktop.
* **Resize** – hover a widget and drag the little corner grip (double-click it to reset). Every widget has a minimum and maximum size (0.6×–1.6×; Now Playing 0.6×–1.5×).
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
* If album art or track info looks wrong, the media helper writes diagnostics to `%TEMP%\wingits-media.log`.
* Now Playing reads Windows' media session (the same one behind the volume flyout), so it shows any player that reports to Windows. A player that doesn't (some older or portable ones) won't appear. The visualizer uses system-audio loopback; if that is unavailable it falls back to a gentle idle animation (click the bars to retry).
* Windows only has been designed for; Linux/macOS builds are untested.

## License

MIT
