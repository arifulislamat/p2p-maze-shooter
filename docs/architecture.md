# Architecture Overview

A quick guide to how the game is structured, what each file does, and how the pieces talk to each other.

---

## File Load Order

Scripts are loaded in strict order in `src/index.html`:

```
constants.js → sound.js → physics.js → renderer.js → network.js → game.js
```

Each file is an IIFE that exposes a single global (`CONFIG`/`Sound`/`Physics`/`Renderer`/`Network`/`Game`). There is no bundler — just include order.

---

## What Each File Does

| File | Global | Responsibility |
|---|---|---|
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
