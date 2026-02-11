# ⚔ P2P Maze Shooter

A real-time peer-to-peer multiplayer shooter built entirely with **vanilla JavaScript** — no frameworks, no build tools, no server. Just open `index.html` and play.

> Two players battle across 6 rotating maze arenas, dodging bombs and zombies, in a retro-neon browser game powered by WebRTC.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![No Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)
![Vanilla JS](https://img.shields.io/badge/built%20with-vanilla%20JS-yellow.svg)

---

## Features

- **Peer-to-peer multiplayer** — Direct browser-to-browser via WebRTC (PeerJS). No game server needed.
- **Host-authoritative networking** — Host runs physics, broadcasts state; guest sends inputs. Cheat-resistant by design.
- **6 unique maze arenas** — Each with distinct layouts: Arena Classic, The Labyrinth, Bomb Alley, Fortress, Snake Pit, Crossfire.
- **Automatic map rotation** — Maps shuffle and rotate every 60 seconds. After 6 maps (6 min), highest score wins.
- **Dynamic hazards** — Bombs spawn randomly with a heartbeat fuse animation and area-of-effect blast. Zombies roam the maze and freeze you on contact.
- **Retro-neon aesthetic** — Scanline overlay, CRT glow effects, pulsing neon colors, and a dark arcade palette.
- **Zero build step** — Pure HTML/CSS/JS. No bundler, no transpiler, no `npm install`. Clone and open.

## Quick Start

```bash
# Clone the repo
git clone https://github.com/arifulislamat/p2p-maze-shooter.git
cd p2p-maze-shooter

# Serve locally (any static server works)
npx serve .
# or
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

> **Note:** You can also open `index.html` directly in a browser (`file://`), but WebRTC connectivity works best when served over HTTP/HTTPS.

### Browser Support

| Browser     | Status         | Notes                                                                              |
| ----------- | -------------- | ---------------------------------------------------------------------------------- |
| **Firefox** | ✅ Supported   | Requires disabling `media.peerconnection.ice.obfuscate_host_addresses` (see below) |
| Chrome      | 🚧 Coming soon |                                                                                    |
| Edge        | 🚧 Coming soon |                                                                                    |
| Safari      | 🚧 Coming soon |                                                                                    |

#### Firefox Setup

Firefox obfuscates local IPs by default, which prevents WebRTC peer discovery on local networks. To play:

1. Open `about:config` in Firefox
2. Search for `media.peerconnection.ice.obfuscate_host_addresses`
3. Set it to **`false`**
4. Reload the game page

> Cross-browser support is actively being worked on. Star the repo to stay updated!

### How to Play

1. **Create a game** → Click "CREATE GAME ROOM" to host. Share the invite link.
2. **Join a game** → Paste the room code or use the invite link.
3. **Controls** → `W A S D` to move, `Space` to shoot, `R` to restart.

## Architecture

```
index.html          Entry point + lobby UI
├── constants.js    Game config, maze data, parseMaze()
├── physics.js      Collision detection (AABB)
├── renderer.js     Canvas rendering, HUD, effects
├── network.js      PeerJS wrapper, room codes, connection lifecycle
├── game.js         Game loop, state machine, input, networking
└── styles.css      Lobby + HUD styles
```

All modules use the **IIFE pattern** (Immediately Invoked Function Expression) to avoid polluting the global scope.

### Data Flow

```
Host                              Guest
┌──────────┐   WebRTC (PeerJS)   ┌──────────┐
│ Input     │◄───── inputs ──────│ Input     │
│ Physics   │                    │           │
│ Game Loop │───── full state ──►│ Renderer  │
│ Renderer  │                    │           │
└──────────┘                     └──────────┘
```

The **host** runs the authoritative simulation (physics, collisions, spawning) and broadcasts the full game state ~60 times per second. The **guest** sends only input deltas and applies received state for rendering.

## Game Rules

| Rule               | Detail                                                               |
| ------------------ | -------------------------------------------------------------------- |
| **Match duration** | 6 maps × 1 min = 6 minutes total                                     |
| **Instant win**    | First to 5 kills wins immediately                                    |
| **Timeout win**    | After 6 minutes, highest kill count wins                             |
| **Tiebreaker**     | If kills are equal, higher health wins; otherwise it's a draw        |
| **Respawn**        | 3-second respawn timer after death                                   |
| **Bombs**          | Spawn dynamically (cap ramps 1→7), heartbeat fuse, area blast damage |
| **Zombies**        | Roam the maze, freeze players for 3 seconds on contact               |

## Tech Stack

| Layer       | Technology                                     |
| ----------- | ---------------------------------------------- |
| Language    | Vanilla JavaScript (ES6+)                      |
| Rendering   | HTML5 Canvas 2D                                |
| Networking  | WebRTC via [PeerJS](https://peerjs.com/) (CDN) |
| Styling     | Vanilla CSS with CSS variables                 |
| Build tools | None — zero dependencies                       |

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) © [Ariful Islam](https://arifulislamat.com)
