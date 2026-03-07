# Architecture Overview

A quick guide to how the game is structured, what each file does, and how the pieces talk to each other.

---

## File Load Order

Scripts are loaded in strict order in `src/index.html`. **Theme files must load before `constants.js`** so theme data is available when the registry is first queried:

```
PeerJS (CDN)
  → themes/retro-neon.js
  → themes/midnight-void.js
  → themes/sandstorm.js
  → themes/cyber-sakura.js
  → themes/index.js          (theme registry)
  → core/ThemeManager.js      (runtime theme switcher)
  → constants.js
  → sound.js
  → physics.js
  → renderer.js
  → network.js
  → game.js
```

Each file is an IIFE (or plain global object) that exposes a single global. There is no bundler — just include order.

---

## What Each File Does

| File | Global | Responsibility |
|---|---|---|
| `themes/retro-neon.js` | `retroNeonTheme` | Built-in default theme definition (colors, fonts, rendering, CSS vars). |
| `themes/midnight-void.js` | `midnightVoidTheme` | Midnight Void theme — ultra-dark with indigo/cyan accents. |
| `themes/sandstorm.js` | `sandstormTheme` | Sandstorm theme — warm desert tones for daytime play. |
| `themes/cyber-sakura.js` | `cyberSakuraTheme` | Cyber Sakura theme — cyberpunk with cherry blossom pink. |
| `themes/index.js` | `ThemeRegistry` | Theme registry. Holds all registered themes keyed by `id`, declares `defaultTheme`. |
| `core/ThemeManager.js` | `ThemeManager` | Runtime theme switcher. Mutates `CONFIG.COLORS` and `RENDER_CONFIG.FONTS` in-place, injects CSS vars, dispatches `themechange` event. |
| `constants.js` | `CONFIG` | All gameplay tuning values and maze data. Also exports flat aliases (`PLAYER_SPEED`, `COLORS`, etc.) used everywhere else. |
| `sound.js` | `Sound` | Procedural audio via Web Audio API. Zero sound files — every effect is synthesized. |
| `physics.js` | `Physics` | AABB wall collision and bounds clamping. Reads `activeMaze.walls`. |
| `renderer.js` | `Renderer` | All Canvas 2D drawing — maze, players, HUD, effects, overlays. Reads `activeMaze.grid` and `COLORS`. |
| `network.js` | `Network` | PeerJS (WebRTC) wrapper. Manages peer lifecycle, room codes, reconnect logic, and reliable-over-unreliable messaging. |
| `game.js` | `Game` | The entire game loop — state machine, input, entity spawning, physics ticks, network sends, UI wiring. |

---

## The Game Loop

The loop runs via `requestAnimationFrame`. Physics runs on a **fixed 60 Hz timestep** using an accumulator; rendering runs every frame (any refresh rate).

```
rAF fires
  │
  ├─ accumulate dt (capped at 100 ms so a frozen tab doesn't spiral)
  │
  ├─ if accumulator ≥ 16.67 ms → physics tick
  │     ├─ savePhysicsPositions()      ← snapshot prev positions
  │     ├─ process input
  │     ├─ move players, fire bullets
  │     ├─ update bombs / zombies / pickups
  │     ├─ send network messages
  │     └─ accumulator -= 16.67
  │
  ├─ alpha = accumulator / 16.67      ← sub-tick interpolation factor
  ├─ interpolateForRender(alpha)       ← lerp positions toward next tick
  ├─ Renderer.draw(…)
  └─ restorePhysicsPositions()         ← put physics state back
```

On high-refresh displays (120/144 Hz) entities glide smoothly because rendering is decoupled from physics.

---

## Game State Machine

All UI and gameplay transitions flow through `STATE.*` values defined in `constants.js`.

```
LOBBY
  │
  ├─── start local game ───────────────────→ COUNTDOWN → PLAYING → GAME_OVER
  │
  └─── host/join online ───────────────────→ COUNTDOWN → PLAYING → GAME_OVER
                                                │
                                          DataChannel closes
                                                │
                                         RECONNECTING (75 s window)
                                                │
                                     success │   │ timeout
                                        PLAYING   LOBBY
```

---

## Host-Authoritative Networking

One player is the **host** and one is the **guest**. The host runs the full simulation. The guest is a "dumb terminal" — it displays whatever the host sends.

**What the host sends:**
- **60 Hz** — `host_input`: P1 and P2 positions + host's key state
- **10 Hz** — `correction`: health, scores, bombs, zombies, health packs, explosions, game state
- **On connect/reconnect** — `broadcastState`: full entity snapshot

**What the guest sends:**
- **60 Hz** — `input`: its WASD + Space key state

**On the guest side:**
- P1 and P2 positions come directly from `hostP1State` / `hostP2State` (no local prediction, no lerp)
- Guest handles its own bullet *creation* locally for responsiveness; position truth always comes from host
- Authority state (health, score, alive) is snapped from corrections immediately

---

## Shared Global: `activeMaze`

Both `Physics` and `Renderer` read from a module-level `activeMaze` object that is set by `parseMaze()` in `constants.js`. When the maze rotates:

1. `parseMaze(mazeKey)` rebuilds `activeMaze.walls`, `activeMaze.grid`, `activeMaze.p1Spawns`, etc.
2. `Renderer.invalidateMazeCache()` forces the off-screen maze texture to be redrawn.
3. Players are repositioned to the new spawn points.

Never mutate `activeMaze` directly — always call `parseMaze()` so all consumers stay in sync.

---

## Touch Controls

Mobile portrait layout adds a `#touch-controls` bar at the bottom. The left half maps to shooting (`Space`), the right half is a floating-knob joystick that maps 8 directional sectors to WASD. The controls work by writing into the same `keys` object that keyboard events use — the rest of the game code doesn't know the difference.

`resizeCanvas()` subtracts the bar height from the canvas so game content never hides behind it.

---

## Theme System

The game's entire visual style — canvas colors, fonts, rendering effects, and CSS custom properties — is driven by a data-driven theme system. Themes can be switched at runtime from the lobby settings panel with zero code changes to the engine.

### How It Works

```
Theme file (e.g. retro-neon.js)
  ↓ registers into
ThemeRegistry (themes/index.js)
  ↓ queried by
ThemeManager (core/ThemeManager.js)
  ↓ mutates at runtime
CONFIG.COLORS        → all canvas rendering picks up new colors
RENDER_CONFIG.FONTS  → all canvas text uses new fonts
:root CSS vars       → all DOM/CSS UI updates
canvas.style         → rendering hints (pixelated, etc.)
localStorage         → persists selection across reloads
CustomEvent          → game loop reacts (invalidates maze cache)
```

### Theme Structure

Each theme is a plain JS object with this shape:

```javascript
const myTheme = {
  id:        "my-theme",          // unique slug, used as registry key
  label:     "My Theme",          // human-readable name shown in UI
  colors:    { /* ~60 keys */ },  // canvas color tokens (keyed to CONFIG.COLORS)
  fonts:     { canvas: { … } },  // font strings (keyed to RENDER_CONFIG.FONTS)
  rendering: { … },              // glowEnabled, scanlines, pixelated, playerShape
  sounds:    { … },              // all null for procedural audio (future: samples)
  cssVars:   { /* --key: val */ } // injected into :root for DOM styling
};
```

### Built-in Themes

| Theme | File | Description |
|---|---|---|
| Retro Neon | `themes/retro-neon.js` | The original dark arcade neon palette |
| Midnight Void | `themes/midnight-void.js` | Ultra-dark with indigo/cyan accents |
| Sandstorm | `themes/sandstorm.js` | Warm light desert tones for daytime play |
| Cyber Sakura | `themes/cyber-sakura.js` | Cyberpunk with cherry blossom pink and jade green |

For a step-by-step guide on creating a new theme, see [adding-themes.md](adding-themes.md).
