# Contributing to P2P Maze Shooter

Thanks for your interest in contributing! This is a vanilla JS project with zero build tools — keeping things simple is a core principle.

## Getting Started

1. Fork and clone the repo
2. Open `index.html` in a browser (or `npx serve .` for local HTTP)
3. Make your changes and test in-browser

## Project Principles

- **No build step.** No bundlers, transpilers, or package managers. If it can't run by opening `index.html`, it doesn't ship.
- **No external dependencies** (except PeerJS via CDN for WebRTC).
- **IIFE module pattern.** Each file is a self-contained module. Keep new code consistent with this style.
- **Host-authoritative networking.** The host owns game state. Guests only send input.

## Architecture Quick Reference

| File | Responsibility |
|------|---------------|
| `constants.js` | Config, maze data, `parseMaze()` |
| `physics.js` | Collision detection |
| `renderer.js` | Canvas drawing, HUD, effects |
| `network.js` | PeerJS wrapper, connection lifecycle |
| `game.js` | Game loop, state machine, input handling |
| `styles.css` | Lobby and UI styles |
| `index.html` | Entry point, lobby HTML |

## How to Contribute

1. **Open an issue** first to discuss non-trivial changes.
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Keep commits focused and descriptive.
4. Test both host and guest sides for any networking changes.
5. Open a pull request with a clear description of what and why.

## Code Style

- Use `const` / `let` (no `var`).
- 2-space indentation.
- Descriptive variable names over comments.
- Keep functions small and single-purpose.

## Adding a New Maze

1. Add a new entry to the `MAZES` object in `constants.js`.
2. Use numbers: `0` = path, `1` = wall, `2` = P1 spawn, `3` = P2 spawn, `4` = zombie, `5` = bomb.
3. Grid must be 21 columns × 15 rows.
4. Place P1 and P2 spawns in diagonally opposite corners.
5. Surround the grid with walls (row 0, row 14, col 0, col 20).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
