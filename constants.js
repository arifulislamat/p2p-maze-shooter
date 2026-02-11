// ===========================================
// Game Constants & Configuration
// ===========================================

const CONFIG = {
  CANVAS: {
    WIDTH: 1200,
    HEIGHT: 800,
  },
  PLAYER: {
    SIZE: 20,
    SPEED: 4, // px per frame
    HEALTH: 5,
    RESPAWN_MS: 3000,
  },
  BULLET: {
    WIDTH: 12,
    HEIGHT: 5,
    SIZE: 8, // kept for legacy bounds checks
    SPEED: 10, // px per frame
    FIRE_RATE_MS: 150,
  },
  SCORE: {
    WIN: 12,
  },
  DIRECTIONS: {
    P1: { dx: 1, dy: 0 },
    P2: { dx: -1, dy: 0 },
  },
  CELLS: {
    PATH: 0,
    WALL: 1,
    P1: 2,
    P2: 3,
    ZOMBIE: 4,
    BOMB: 5,
  },
  MAZE: {
    COLS: 21,
    ROWS: 15,
    ROTATION_MS: 1 * 60 * 1000,
  },
  COUNTDOWN: {
    DURATION_S: 3,
  },
  BOMB: {
    SPAWN_INTERVAL_MS: 5000,
    FUSE_MS: 3000,
    BLAST_RADIUS: 120,
    BLAST_DAMAGE: 2,
    BLAST_ANIM_MS: 500,
    MAX_BOMBS: 7,
  },
  ZOMBIE: {
    SPAWN_INTERVAL_MS: 6000,
    MAX_ZOMBIES: 3,
    FREEZE_MS: 3000,
    HITBOX_RADIUS: 18,
    LIFETIME_MS: 10000,
  },
  COLORS: {
    background: "#0a0a1a",
    border: "#2a2a4a",
    wall: "#2d2d4a",
    wallStroke: "#4a4a6a",
    wallInner: "rgba(100,100,160,0.2)",
    path: "#0a0a1a",
    p1: "#00d4ff",
    p1Dark: "#0099bb",
    p1Spawn: "#003344",
    p1SpawnBorder: "#00d4ff",
    p2: "#ff4444",
    p2Dark: "#cc2222",
    p2Spawn: "#330011",
    p2SpawnBorder: "#ff4444",
    zombie: "#44ff44",
    zombieGlow: "#0a1a0a",
    bomb: "#ffaa00",
    bombGlow: "#1a1500",
    bullet: "#f39c12",
    bulletStroke: "#e67e22",
    bulletP1: "#88ffff",
    bulletP1Glow: "#00ffff",
    bulletP2: "#ff8888",
    bulletP2Glow: "#ff4444",
    healthGreen: "#2ecc71",
    healthRed: "#e74c3c",
    healthBg: "#333333",
    hudText: "#ccccee",
    white: "#ffffff",
  },
};

const CANVAS_WIDTH = CONFIG.CANVAS.WIDTH;
const CANVAS_HEIGHT = CONFIG.CANVAS.HEIGHT;

// Player — half the smaller cell dimension so it fits centered in a cell
const PLAYER_SIZE = Math.floor(
  Math.min(CANVAS_WIDTH / CONFIG.MAZE.COLS, CANVAS_HEIGHT / CONFIG.MAZE.ROWS) /
    2,
);
const PLAYER_SPEED = CONFIG.PLAYER.SPEED;
const PLAYER_HEALTH = CONFIG.PLAYER.HEALTH;
const RESPAWN_TIME = CONFIG.PLAYER.RESPAWN_MS;

// Bullets
const BULLET_SIZE = CONFIG.BULLET.SIZE;
const BULLET_WIDTH = CONFIG.BULLET.WIDTH;
const BULLET_HEIGHT = CONFIG.BULLET.HEIGHT;
const BULLET_SPEED = CONFIG.BULLET.SPEED;
const FIRE_RATE = CONFIG.BULLET.FIRE_RATE_MS;

// Scoring
const WIN_SCORE = CONFIG.SCORE.WIN;

// Colors — dark retro theme matching maze.jsx
const COLORS = CONFIG.COLORS;

// Default facing directions
const DEFAULT_DIR_P1 = CONFIG.DIRECTIONS.P1; // facing right
const DEFAULT_DIR_P2 = CONFIG.DIRECTIONS.P2; // facing left

// Maze cell types — matches maze.jsx legend
// 0 = path, 1 = wall, 2 = P1 spawn, 3 = P2 spawn, 4 = zombie spawn, 5 = bomb zone
const CELL_PATH = CONFIG.CELLS.PATH;
const CELL_WALL = CONFIG.CELLS.WALL;
const CELL_P1 = CONFIG.CELLS.P1;
const CELL_P2 = CONFIG.CELLS.P2;
const CELL_ZOMBIE = CONFIG.CELLS.ZOMBIE;
const CELL_BOMB = CONFIG.CELLS.BOMB;

// Grid dimensions (all mazes are 21×15)
const MAZE_COLS = CONFIG.MAZE.COLS;
const MAZE_ROWS = CONFIG.MAZE.ROWS;
const CELL_W = CANVAS_WIDTH / MAZE_COLS;
const CELL_H = CANVAS_HEIGHT / MAZE_ROWS;

// Maze rotation interval (5 minutes)
const MAZE_ROTATION_MS = CONFIG.MAZE.ROTATION_MS;

// ---- All Mazes ----
const MAZES = {
  arena_classic: {
    name: "ARENA CLASSIC",
    desc: "Symmetrical combat arena with central crossroads and corner bunkers",
    data: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 3, 1],
      [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1],
      [1, 1, 1, 0, 1, 4, 0, 1, 0, 1, 5, 1, 0, 1, 0, 4, 1, 0, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 5, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 0, 1, 4, 0, 1, 0, 1, 5, 1, 0, 1, 0, 4, 1, 0, 1, 1, 1],
      [1, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1],
      [1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1],
      [1, 3, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
  },
  the_labyrinth: {
    name: "THE LABYRINTH",
    desc: "Winding corridors with dead ends — perfect for ambushes",
    data: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 2, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 3, 1],
      [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 4, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1],
      [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
      [1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 4, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1],
      [1, 3, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 2, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
  },
  bomb_alley: {
    name: "BOMB ALLEY",
    desc: "Open corridors with many bomb zones — nowhere is safe for long",
    data: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 2, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 3, 1],
      [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 1],
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 1],
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
      [1, 3, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 2, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
  },
  fortress: {
    name: "FORTRESS",
    desc: "Four fortified rooms with a dangerous open center",
    data: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 3, 1],
      [1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 1, 4, 0, 0, 0, 0, 0, 4, 1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1],
      [1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 5, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1],
      [1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1, 4, 0, 0, 0, 0, 0, 4, 1, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1],
      [1, 3, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
  },
  snake_pit: {
    name: "SNAKE PIT",
    desc: "Long winding corridors force close-range encounters",
    data: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
      [1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
  },
  crossfire: {
    name: "CROSSFIRE",
    desc: "Long sight lines and open crosses — a sniper's paradise",
    data: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 3, 1],
      [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
      [1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1],
      [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
      [1, 0, 1, 0, 1, 4, 0, 0, 0, 0, 5, 0, 0, 0, 0, 4, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 5, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 0, 1, 4, 0, 0, 0, 0, 5, 0, 0, 0, 0, 4, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
      [1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1],
      [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
      [1, 3, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
  },
};

const MAZE_KEYS = Object.keys(MAZES);

// ---- Maze Helper Functions ----

// Convert a maze grid to obstacle rects + extract spawn positions
function parseMaze(mazeKey) {
  const maze = MAZES[mazeKey];
  const walls = [];
  let p1Spawns = [];
  let p2Spawns = [];

  for (let r = 0; r < MAZE_ROWS; r++) {
    for (let c = 0; c < MAZE_COLS; c++) {
      const cell = maze.data[r][c];
      const rect = { x: c * CELL_W, y: r * CELL_H, w: CELL_W, h: CELL_H };

      if (cell === CELL_WALL) {
        walls.push(rect);
      } else if (cell === CELL_P1) {
        p1Spawns.push({
          x: c * CELL_W + (CELL_W - PLAYER_SIZE) / 2,
          y: r * CELL_H + (CELL_H - PLAYER_SIZE) / 2,
          row: r,
          col: c,
        });
      } else if (cell === CELL_P2) {
        p2Spawns.push({
          x: c * CELL_W + (CELL_W - PLAYER_SIZE) / 2,
          y: r * CELL_H + (CELL_H - PLAYER_SIZE) / 2,
          row: r,
          col: c,
        });
      }
    }
  }

  // Collect path cells for random bomb spawning
  const pathCells = [];
  for (let r = 0; r < MAZE_ROWS; r++) {
    for (let c = 0; c < MAZE_COLS; c++) {
      if (maze.data[r][c] === CELL_PATH) {
        pathCells.push({ r, c });
      }
    }
  }

  return {
    key: mazeKey,
    name: maze.name,
    desc: maze.desc,
    walls,
    p1Spawns,
    p2Spawns,
    pathCells,
    grid: maze.data,
  };
}

// Active maze state — set by Game module
let activeMaze = parseMaze("arena_classic");

// Game states
const STATE = {
  LOBBY: "lobby",
  COUNTDOWN: "countdown",
  PLAYING: "playing",
  GAME_OVER: "game_over",
};

// Countdown duration
const COUNTDOWN_DURATION = CONFIG.COUNTDOWN.DURATION_S; // seconds

// Bomb gameplay constants
const BOMB_SPAWN_INTERVAL = CONFIG.BOMB.SPAWN_INTERVAL_MS;
const BOMB_FUSE_TIME = CONFIG.BOMB.FUSE_MS;
const BOMB_BLAST_RADIUS = CONFIG.BOMB.BLAST_RADIUS;
const BOMB_BLAST_DAMAGE = CONFIG.BOMB.BLAST_DAMAGE;
const BOMB_BLAST_ANIM_MS = CONFIG.BOMB.BLAST_ANIM_MS;
const BOMB_MAX = CONFIG.BOMB.MAX_BOMBS;

// Zombie gameplay constants
const ZOMBIE_SPAWN_INTERVAL = CONFIG.ZOMBIE.SPAWN_INTERVAL_MS;
const ZOMBIE_MAX = CONFIG.ZOMBIE.MAX_ZOMBIES;
const ZOMBIE_FREEZE_MS = CONFIG.ZOMBIE.FREEZE_MS;
const ZOMBIE_HITBOX_RADIUS = CONFIG.ZOMBIE.HITBOX_RADIUS;
const ZOMBIE_LIFETIME = CONFIG.ZOMBIE.LIFETIME_MS;
