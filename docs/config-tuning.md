# Config Tuning Guide

Every gameplay number lives in a named config object at the top of its file. This page explains what each value does and what happens when you change it.

---

## `CONFIG` — `src/constants.js`

The main gameplay config. Everything from player speed to bomb blast radius goes here.

### `CONFIG.CANVAS`

| Key      | Default | What it does                                                                       |
| -------- | ------- | ---------------------------------------------------------------------------------- |
| `WIDTH`  | `1200`  | Logical canvas width in pixels. All entity positions are in this coordinate space. |
| `HEIGHT` | `800`   | Logical canvas height.                                                             |

> Changing the canvas size also changes where walls land (walls are sized relative to the canvas) so you'll need to test all 6 mazes if you adjust this.

---

### `CONFIG.PLAYER`

| Key          | Default | What it does                                                                                        |
| ------------ | ------- | --------------------------------------------------------------------------------------------------- |
| `SIZE`       | `20`    | Used to derive `PLAYER_SIZE` (actually computed as half a grid cell). Adjust the grid dims instead. |
| `SPEED`      | `4`     | px moved per physics tick. Higher = faster player.                                                  |
| `HEALTH`     | `12`    | Starting and max HP.                                                                                |
| `RESPAWN_MS` | `3000`  | How long a dead player waits before respawning (ms).                                                |

---

### `CONFIG.BULLET`

| Key                | Default    | What it does                                                                                                  |
| ------------------ | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `SPEED`            | `10`       | px per tick. Bullets that are too slow let players dodge freely; too fast and the game feels unfair at range. |
| `FIRE_RATE_MS`     | `150`      | Minimum ms between shots in normal mode. Lower = shoot faster.                                                |
| `WIDTH` / `HEIGHT` | `12` / `5` | Visual size of the bullet rectangle.                                                                          |

---

### `CONFIG.SCORE`

| Key   | Default | What it does                                                                          |
| ----- | ------- | ------------------------------------------------------------------------------------- |
| `WIN` | `8`     | First player to reach this many kills wins immediately, regardless of time remaining. |

---

### `CONFIG.MAZE`

| Key             | Default     | What it does                                                                                     |
| --------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| `COLS` / `ROWS` | `21` / `15` | Grid dimensions all mazes must match. Adding a map that doesn't match causes rendering glitches. |
| `ROTATION_MS`   | `60000`     | How long before the map changes (ms). 6 mazes × 60 s = 6 min total match.                        |

---

### `CONFIG.BOMB`

| Key                 | Default | What it does                                                                                                              |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `SPAWN_INTERVAL_MS` | `5000`  | How often a new bomb can spawn (ms).                                                                                      |
| `FUSE_MS`           | `1500`  | Delay from bomb placement to detonation. Longer = more time to escape.                                                    |
| `BLAST_RADIUS`      | `200`   | Explosion radius in px.                                                                                                   |
| `BLAST_DAMAGE`      | `4`     | HP removed on direct hit.                                                                                                 |
| `BLAST_ANIM_MS`     | `500`   | How long the explosion visual lingers.                                                                                    |
| `MAX_BOMBS`         | `4`     | Hard cap on simultaneous active bombs. The active cap ramps up over the maze lifespan from `INITIAL_COUNT` to this value. |
| `INITIAL_COUNT`     | `3`     | How many bombs are allowed to be active at the very start of a maze.                                                      |

---

### `CONFIG.ZOMBIE`

| Key                 | Default | What it does                                                               |
| ------------------- | ------- | -------------------------------------------------------------------------- |
| `SPAWN_INTERVAL_MS` | `6000`  | How often a zombie spawns (ms).                                            |
| `MAX_ZOMBIES`       | `3`     | Max zombies alive at once.                                                 |
| `FREEZE_MS`         | `3000`  | How long a player is frozen after zombie contact.                          |
| `HITBOX_RADIUS`     | `18`    | Contact distance in px that triggers a freeze.                             |
| `LIFETIME_MS`       | `10000` | A zombie despawns after this many ms if it never touches anyone (10 s).    |
| `SPEED`             | `0.8`   | Chase speed in px per tick. Slow enough to avoid, fast enough to threaten. |

---

### `CONFIG.GAMEPLAY`

| Key                             | Default | What it does                                                            |
| ------------------------------- | ------- | ----------------------------------------------------------------------- |
| `DAMAGE_FLASH_MS`               | `150`   | How long the red edge flash stays on screen after taking damage.        |
| `LOW_HEALTH_THRESHOLD`          | `4`     | HP at or below this value activates the pulsing vignette.               |
| `HEALTH_PACK_SPAWN_INTERVAL_MS` | `8000`  | How often a health pack can spawn.                                      |
| `HEALTH_PACK_MAX`               | `1`     | Max health packs on the field at once.                                  |
| `HEALTH_PACK_HEAL`              | `3`     | HP restored on pickup (capped at `PLAYER_HEALTH`).                      |
| `FLOATING_TEXT_DURATION_MS`     | `1200`  | How long kill/damage popups float before fading.                        |
| `URGENT_MAZE_TIME_S`            | `10`    | Seconds remaining that trigger the countdown tick sound + screen shake. |
| `SPEED_BOOST_SPAWN_INTERVAL_MS` | `12000` | How often a speed boost pickup can spawn.                               |
| `SPEED_BOOST_MAX`               | `1`     | Max speed boosts on the field.                                          |
| `SPEED_BOOST_DURATION_MS`       | `4000`  | How long the boost lasts after pickup.                                  |
| `SPEED_BOOST_MULTIPLIER`        | `1.6`   | Speed multiplier during boost (1.6 = 60% faster).                       |
| `WEAPON_SPAWN_INTERVAL_MS`      | `10000` | How often a weapon pickup spawns.                                       |
| `WEAPON_MAX`                    | `1`     | Max weapon pickups on the field.                                        |
| `RAPID_FIRE_DURATION_MS`        | `5000`  | How long rapid-fire mode lasts.                                         |
| `RAPID_FIRE_RATE_MS`            | `50`    | Fire-rate cooldown in rapid-fire mode (lower = faster).                 |
| `SCATTER_DURATION_MS`           | `5000`  | How long scatter-shot mode lasts.                                       |
| `SCATTER_SPREAD_DEG`            | `25`    | Angle in degrees between the three scatter bullets.                     |

---

## `GAME_CONFIG` — `src/game.js`

Engine and UX tuning that doesn't belong in gameplay constants.

### `GAME_CONFIG.PHYSICS`

| Key       | Default             | What it does                                                                            |
| --------- | ------------------- | --------------------------------------------------------------------------------------- |
| `STEP_MS` | `1000/60` ≈ `16.67` | Physics timestep in ms. Do not change this unless you also scale all speeds and timers. |

### `GAME_CONFIG.NETWORK`

| Key                      | Default | What it does                                                                                                              |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `CORRECTION_INTERVAL_MS` | `100`   | How often the host pushes authority corrections to the guest (10 Hz).                                                     |
| `DATA_TIMEOUT_MS`        | `5000`  | Guest triggers a reconnect attempt if no data arrives for this long.                                                      |
| `RECONNECT_TIMEOUT_MS`   | `75000` | Total reconnect window before giving up and returning to lobby. Must be longer than PeerJS server's ~60 s peer ID expiry. |
| `RECONNECT_INTERVAL_MS`  | `3000`  | How often a reconnect attempt is made inside the reconnect window.                                                        |
| `LOBBY_MAX_RETRIES`      | `5`     | How many times room creation is retried before showing an error.                                                          |

### `GAME_CONFIG.TOUCH`

| Key              | Default | What it does                                                                                                                              |
| ---------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `DEAD_ZONE`      | `14`    | Minimum drag distance (px) before the joystick registers a direction. Reduce for more sensitive feel, increase to reduce accidental taps. |
| `BASE_RADIUS`    | `65`    | Half the joystick circle diameter. The knob moves within this radius.                                                                     |
| `SPIN_WINDOW_MS` | `2000`  | All 4 quadrants must be swept within this time to trigger a spin easter egg.                                                              |

### `GAME_CONFIG.VIEWPORT`

| Key           | Default | What it does                                                               |
| ------------- | ------- | -------------------------------------------------------------------------- |
| `SAFE_MARGIN` | `24`    | px buffer kept on all edges of the browser window when fitting the canvas. |
| `MAX_SCALE`   | `2`     | Canvas never scales above 2× even on very large screens.                   |

---

## `RENDER_CONFIG` — `src/renderer.js`

Visual layout constants. Only relevant if you change fonts or HUD layout.

| Section   | Key                      | What it does                                                                   |
| --------- | ------------------------ | ------------------------------------------------------------------------------ |
| `HUD`     | `HEIGHT`                 | Pixel height of the HUD strip at the top of the canvas.                        |
| `HUD`     | `HEALTH_WIDTH / HEIGHT`  | Size of each player's health bar in the HUD.                                   |
| `FONTS`   | All entries              | Font strings for every text element. All use `Courier New` for the retro look. |
| `EFFECTS` | `SCANLINE_STEP / ALPHA`  | Spacing and opacity of the CRT scanline overlay. Set `ALPHA` to 0 to disable.  |
| `EFFECTS` | `MAZE_ANNOUNCE_MS`       | How long the "maze name" overlay stays on screen between rotations.            |
| `EFFECTS` | `DAMAGE_FLASH_ALPHA`     | Max opacity of the damage flash edge overlay.                                  |
| `EFFECTS` | `LOW_HEALTH_PULSE_ALPHA` | Max opacity of the low-health vignette pulse.                                  |

---

## `NETWORK_CONFIG` — `src/network.js`

WebRTC / PeerJS connection settings.

| Key                      | Default                         | What it does                                                                                               |
| ------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ROOM_CODE_LENGTH`       | `6`                             | Length of the generated room code.                                                                         |
| `ROOM_CODE_CHARS`        | (see file)                      | Character set — excludes visually confusable characters (0/O, 1/I/l).                                      |
| `PEER_PREFIX`            | `"p2p-shooter-"`                | Prefix added to each peer ID on PeerJS servers.                                                            |
| `PEER_DEBUG`             | `2` on localhost, `0` elsewhere | PeerJS logging level. 0 = silent, 2 = verbose.                                                             |
| `ICE_SERVERS`            | 5 Google STUN servers           | STUN servers used for ICE negotiation. Add TURN servers here if you need relay support behind strict NATs. |
| `OPEN_POLL_MAX_ATTEMPTS` | `150`                           | Give up waiting for a DataChannel to become ready after ~15 s (150 × 100 ms).                              |

---

## `SOUND_CONFIG` — `src/sound.js`

Volume and frequency knobs for every synthesized sound. All values are passed directly to Web Audio API nodes.

| Sound        | Keys available                                                            |
| ------------ | ------------------------------------------------------------------------- |
| `shoot`      | `volume`, `freqStart`, `freqEnd`, `duration`                              |
| `hit`        | `volume`, `filterFreq`, `filterQ`, `duration`                             |
| `death`      | `volume`, `freqStart`, `freqEnd`, `duration`                              |
| `explosion`  | `noiseVolume`, noise freq sweep, `rumbleVolume`, rumble freq              |
| `freeze`     | `volume`, `freqStart`, `freqEnd`, `duration`                              |
| `countdown`  | `volume`, `freq`, `duration`                                              |
| `go`         | `volume`, `freqs` (array of 3), `duration`                                |
| `respawn`    | `volume`, `freqs` (array of 4 ascending), `stepDuration`, `totalDuration` |
| `mazeChange` | `volume`, filter freq sweep, `filterQ`, `duration`                        |
| `gameOver`   | `volume`, `freqStart`, `freqEnd`, `duration`                              |
| `victory`    | `volume`, `freqs` (4-note fanfare), `stepDuration`                        |
| `connected`  | `volume`, `freq1`, `freq2`, `stepDuration`                                |

Set any `volume` to `0` to silence that effect without removing its code.
