# Adding a New Map

All maps are defined in `src/constants.js` inside the `MAZES` object. Adding a map is purely data — no code changes needed.

---

## Grid Format

Every maze is a 2D array of integers: **15 rows × 21 columns**. Each integer is a cell type:

| Value | Constant | Meaning |
|---|---|---|
| `0` | `CELL_PATH` | Walkable floor |
| `1` | `CELL_WALL` | Solid wall |
| `2` | `CELL_P1` | P1 (blue) spawn point |
| `3` | `CELL_P2` | P2 (red) spawn point |
| `4` | `CELL_ZOMBIE` | Zombie spawn hint (marks where zombies can appear) |
| `5` | `CELL_BOMB` | Bomb pre-placement hint |

A few rules:
- The entire outer border must be `1` (wall). Players can't leave the arena.
- Include at least one `2` and one `3` (spawn points for each player). Multiple spawn cells are fine — the game picks the one farthest from the killer on respawn.
- `4` and `5` mark positions that `parseMaze()` collects, but game code still uses random path-cell spawning for runtime bomb/zombie placement. They serve as design hints and are rendered as plain floor at run time.
- All rows must be exactly 21 cells wide, all columns exactly 15 cells tall (matching `CONFIG.MAZE.COLS` / `CONFIG.MAZE.ROWS`).

---

## Step-by-Step

### 1. Draft the grid

The easiest way is to write it out as a 15×21 block in a text editor using `0` and `1`, then go back and add spawn hints. For reference, here's a minimal valid map skeleton:

```
Row 0:  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
Row 1:  [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1],
…
Row 13: [1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],
Row 14: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
```

P1 spawns are in the top-left area, P2 spawns in the top-right (they swap diagonally on alternate mazes, so place them symmetrically if possible).

### 2. Add the map entry to `MAZES`

Open `src/constants.js` and add your map inside the `MAZES` object, alongside the existing ones:

```javascript
const MAZES = {
  arena_classic: { … },
  // … other maps …

  my_new_map: {
    name: "MY NEW MAP",        // All-caps, shown in HUD and announcements
    desc: "Short description shown in the lobby map selector",
    data: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1],
      // … 11 more rows …
      [1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
  },
};
```

That's it. `MAZE_KEYS = Object.keys(MAZES)` picks up the new key automatically, so the map will appear in the lobby selector and be included in the maze rotation.

### 3. Test it

Open `src/index.html` directly in a browser (no build step). Select your map in the lobby and start a local game. Check that:

- Players spawn at the right positions
- No player or bullet spawns inside a wall
- Bullets don't pass through walls unexpectedly (diagonal corridors can cause thin-wall clipping)
- The maze doesn't feel too open (long sight lines mean whoever shoots first always wins)

---

## Tips

**Symmetry helps balance.** If both players have the same wall cover options, skill matters more than spawn luck. Horizontal symmetry (mirror left/right) or rotational symmetry (180° rotation) both work well.

**Leave room to move.** Corridors narrower than 2–3 cells feel claustrophobic and bullet-snapping becomes very punishing. At least some areas should have room to dodge.

**Place `4` and `5` hints away from spawn points.** The game tries to find path cells far from players before spawning dynamic entities, but the hint positions are collected directly, so having them next to spawn cells can cause immediate zombie contact on round start.

**The match uses all maps in rotation.** After 6 mazes (one per minute), the match ends. If you have more than 6 maps in MAZES, only 6 will be played per match (chosen randomly), so every map gets fair exposure over multiple sessions.

---

## The Lobby Map Selector

The map dropdown in the lobby is built dynamically in `src/index.html` by iterating over `MAZE_KEYS`:

```html
<script>
  MAZE_KEYS.forEach(key => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = MAZES[key].name + " — " + MAZES[key].desc;
    mazeSelect.appendChild(opt);
  });
</script>
```

No changes needed here — the selector picks up your new map as soon as you add it to `MAZES`.
