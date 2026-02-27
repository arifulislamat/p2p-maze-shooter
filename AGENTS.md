# AGENTS Instruction

## Big picture

- This is a single-page, vanilla JS P2P shooter (no build step). The entry point is `index.html`, which loads scripts in order: `constants.js` -> `sound.js` -> `physics.js` -> `renderer.js` -> `network.js` -> `game.js`.
- Core loop and state live in the `Game` module (IIFE). `Game` owns the tick, input handling, mode switching (local/online host/online guest), and state transitions.
- Networking is host-authoritative: the host simulates physics and broadcasts full state every frame; the guest only sends inputs. See `broadcastState()`/`applyRemoteState()` in `game.js` and `Network.send()` in `network.js`.

## Architecture and data flow

- `constants.js` defines gameplay constants, maze data, and `parseMaze()`. It also owns the global `activeMaze` used by `Physics` and `Renderer`.
- `physics.js` uses `activeMaze.walls` for collision checks; keep wall rectangles aligned to the maze grid.
- `renderer.js` renders the maze grid (`activeMaze.grid`) and HUD every frame. It assumes the retro color palette in `COLORS` from `constants.js`.
- `network.js` wraps PeerJS (via CDN) and manages room codes, connection lifecycle, and the host/guest roles. It attaches a `peer.on('disconnected')` handler on every peer that calls `peer.reconnect()` automatically when the signaling WebSocket drops (e.g. mobile backgrounding). `restoreHost(roomCode, cbs)` and `restoreGuest(roomCode, cbs)` recreate the full peer from scratch with the same room code, used by `game.js`'s reconnect state machine. `getLastRoomCode()` exposes the saved code.
- `sound.js` provides procedural audio via Web Audio API (IIFE, `Sound` global). All 11 sound effects are synthesized — zero audio files. The host queues sounds during the tick via `Sound.play()`, flushes them onto the `broadcastState()` message as a `sounds` array, and the guest plays them via `Sound.playRemote()` in `applyRemoteState()`. Stereo panning is position-based (event x-coordinate mapped to left/right speaker). Mute state is persisted in `localStorage('p2p-muted')`.
- `index.html` contains the lobby UI and inline script for building the maze selector; it calls `Game.*` entry points directly.
- **Mobile touch controls** — `#touch-controls` (inside `#gameContainer`) is a full-width bar shown only under `@media (orientation: portrait) and (max-width: 1024px)`. Left half: `#shoot-btn` (maps `touchstart/end` → `keys["Space"]`). Right half: `#joystick-zone` with a floating-knob joystick that maps 8 directional sectors → `keys["KeyW/A/S/D"]`. Wired in `initTouchControls()` in `game.js`, called from `init()`. `resizeCanvas()` subtracts `#touch-controls.offsetHeight` so the canvas never overlaps the controls bar.

## Project-specific conventions

- Modules are plain IIFEs in the global scope (no bundler, no imports). Keep new code consistent with this pattern.
- `activeMaze` is a shared global; when changing mazes call `parseMaze()` and update `selectedMazeKey` so Renderer/Physics stay in sync.
- Online guest uses WASD + Space for input (same as host). Local 2-player uses WASD/Space for P1 and arrows/Enter for P2.
- Maze rotation happens every 1 minute; all 6 mazes are shuffled and played in order. After all 6 mazes (6 minutes total), the match ends and the player with the most kills wins. A player can also win instantly by reaching `WIN_SCORE` (5) kills. If scores are tied at timeout, health is used as a tiebreaker; otherwise it's a draw.
- **Mobile reconnection** — `STATE.RECONNECTING` is entered when the DataChannel closes but the game is still in `online-host`/`online-guest` mode. `game.js` runs a 30 s reconnect window: every 3 s it calls `Network.restoreHost` or `Network.restoreGuest` to rebuild the peer with the same room code. A `visibilitychange` listener on `document` triggers the same flow proactively when the tab comes back to the foreground. On success the host re-sends `config` to resync maze state. On timeout, `handleDisconnect` falls through to the normal lobby return. The amber `drawReconnecting(secondsLeft)` overlay in `renderer.js` shows a countdown during this window.

## Workflows

- No build system or tests. Open `index.html` directly in a browser (or serve statically if needed).
- PeerJS is loaded from `https://cdn.jsdelivr.net/...` in `index.html`; changes to networking should account for PeerJS behavior and events in `network.js`.

## Rules

- Whenever agentic coding make changes that require to update `AGENTS.md`, then update the instruction.

## Where to look

- Game loop + state machine: `game.js`
- PeerJS wrapper and room code handling: `network.js`
- Procedural sound effects: `sound.js`
- Collision rules: `physics.js`
- Rendering and HUD: `renderer.js`
- Maze definitions and parsing: `constants.js`
- Lobby and connection UI: `index.html` + `styles.css`
