// ===========================================
// Game — Core Game Logic
// ===========================================

const Game = (() => {
  const GAME_CONFIG = {
    INPUT: {
      MOVE_UP: ["KeyW", "ArrowUp"],
      MOVE_DOWN: ["KeyS", "ArrowDown"],
      MOVE_LEFT: ["KeyA", "ArrowLeft"],
      MOVE_RIGHT: ["KeyD", "ArrowRight"],
      SHOOT: ["Space"],
      PREVENT_DEFAULT: [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Space",
      ],
      RESTART: "KeyR",
    },
    NETWORK: {
      RESYNC_INTERVAL_MS: 5000,
    },
    VIEWPORT: {
      SAFE_MARGIN: 24,
      MAX_SCALE: 2,
    },
  };

  let canvas, ctx;
  let gameState = STATE.LOBBY;
  let countdownTimer = 0;
  let countdownValue = 0;
  let winner = null;
  let selectedMazeKey = "arena_classic";
  let mazeRotationStart = 0;

  // ---- Match Timer (6 mazes × 1 min = 6 min total) ----
  let matchStartTime = 0;
  let mazesPlayed = 0;
  let mazeOrder = []; // shuffled order of maze keys
  let isDraw = false;

  // ---- Online Mode State ----
  let gameMode = "lobby"; // 'lobby' | 'online-host' | 'online-guest'
  let remoteInput = {
    up: false,
    down: false,
    left: false,
    right: false,
    shoot: false,
  };
  let isDisconnected = false;
  let displayMazeTimeLeft = null;
  let displayMatchTimeLeft = null;
  let initialized = false;
  let lastResync = 0;

  // ---- Get spawn position from active maze ----
  // Deterministic corner-based spawns that rotate each maze.
  // Even mazes (0, 2, 4…): P1 → top-right, P2 → bottom-left
  // Odd  mazes (1, 3, 5…): P1 → bottom-left, P2 → top-right
  // Both host and guest compute the same result — no network sync needed.

  function getSpawn(playerId) {
    const allSpawns = [...activeMaze.p1Spawns, ...activeMaze.p2Spawns];
    if (allSpawns.length < 2) return allSpawns[0] || { x: 100, y: 100 };

    // Find the spawn closest to top-right and bottom-left corners
    const mazeW = MAZE_COLS * CELL_W;
    const mazeH = MAZE_ROWS * CELL_H;
    let topRight = allSpawns[0],
      topRightDist = Infinity;
    let bottomLeft = allSpawns[0],
      bottomLeftDist = Infinity;

    for (const s of allSpawns) {
      const dTR = (s.x - mazeW) * (s.x - mazeW) + s.y * s.y;
      const dBL = s.x * s.x + (s.y - mazeH) * (s.y - mazeH);
      if (dTR < topRightDist) {
        topRightDist = dTR;
        topRight = s;
      }
      if (dBL < bottomLeftDist) {
        bottomLeftDist = dBL;
        bottomLeft = s;
      }
    }

    const swapped = mazesPlayed % 2 === 1;
    if (playerId === 1) {
      const s = swapped ? bottomLeft : topRight;
      return { x: s.x, y: s.y };
    } else {
      const s = swapped ? topRight : bottomLeft;
      return { x: s.x, y: s.y };
    }
  }

  // ---- Players ----
  function createPlayer(id) {
    const spawn = getSpawn(id);
    const dir = id === 1 ? { ...DEFAULT_DIR_P1 } : { ...DEFAULT_DIR_P2 };
    return {
      id,
      x: spawn.x,
      y: spawn.y,
      dir,
      health: PLAYER_HEALTH,
      alive: true,
      score: 0,
      lastShot: 0,
      respawnTimer: 0,
      freezeTimer: 0,
    };
  }

  let p1 = createPlayer(1);
  let p2 = createPlayer(2);
  let bullets = [];

  // ---- Dynamic Bombs ----
  let bombs = [];
  let explosions = [];
  let lastBombSpawn = 0;

  // ---- Dynamic Zombies ----
  let zombies = [];
  let lastZombieSpawn = 0;

  function getRandomPathCell() {
    const cells = activeMaze.pathCells;
    if (!cells || cells.length === 0) return null;
    // Try a few times to avoid spawning on/near players
    for (let attempt = 0; attempt < 20; attempt++) {
      const cell = cells[Math.floor(Math.random() * cells.length)];
      const cx = cell.c * CELL_W + CELL_W / 2;
      const cy = cell.r * CELL_H + CELL_H / 2;

      // Avoid spawning too close to either player
      const d1 = Math.hypot(
        cx - (p1.x + PLAYER_SIZE / 2),
        cy - (p1.y + PLAYER_SIZE / 2),
      );
      const d2 = Math.hypot(
        cx - (p2.x + PLAYER_SIZE / 2),
        cy - (p2.y + PLAYER_SIZE / 2),
      );
      if (d1 > CELL_W * 2 && d2 > CELL_W * 2) {
        return { x: cx, y: cy };
      }
    }
    // Fallback: just pick one
    const cell = cells[Math.floor(Math.random() * cells.length)];
    return { x: cell.c * CELL_W + CELL_W / 2, y: cell.r * CELL_H + CELL_H / 2 };
  }

  function spawnBomb() {
    // Dynamic cap: ramps from 1 → BOMB_MAX over the maze rotation period
    const elapsed = Date.now() - mazeRotationStart;
    const progress = Math.min(1, elapsed / MAZE_ROTATION_MS); // 0→1
    const currentMax = Math.floor(1 + (BOMB_MAX - 1) * progress);
    if (bombs.length >= currentMax) return;
    const pos = getRandomPathCell();
    if (!pos) return;
    bombs.push({
      x: pos.x,
      y: pos.y,
      fuseLeft: BOMB_FUSE_TIME,
      spawnTime: Date.now(),
    });
  }

  function updateBombs(dt) {
    const now = Date.now();

    // Spawn new bombs periodically
    if (now - lastBombSpawn >= BOMB_SPAWN_INTERVAL) {
      spawnBomb();
      lastBombSpawn = now;
    }

    // Count down fuse and explode
    for (let i = bombs.length - 1; i >= 0; i--) {
      const bomb = bombs[i];
      bomb.fuseLeft -= dt;
      if (bomb.fuseLeft <= 0) {
        // Explode — damage nearby players
        explodeBomb(bomb);
        bombs.splice(i, 1);
      }
    }

    // Clean up expired explosion animations
    for (let i = explosions.length - 1; i >= 0; i--) {
      if (now - explosions[i].startTime > BOMB_BLAST_ANIM_MS) {
        explosions.splice(i, 1);
      }
    }
  }

  function explodeBomb(bomb) {
    explosions.push({ x: bomb.x, y: bomb.y, startTime: Date.now() });

    // Damage players in blast radius
    [p1, p2].forEach((player) => {
      if (!player.alive) return;
      const pcx = player.x + PLAYER_SIZE / 2;
      const pcy = player.y + PLAYER_SIZE / 2;
      const dist = Math.hypot(bomb.x - pcx, bomb.y - pcy);
      if (dist <= BOMB_BLAST_RADIUS) {
        player.health -= BOMB_BLAST_DAMAGE;
        if (player.health <= 0) {
          // Bomb kill — award the other player
          const killer = player.id === 1 ? p2 : p1;
          handlePlayerDeath(player, killer);
        }
      }
    });
  }

  // ---- Dynamic Zombies ----
  function spawnZombie() {
    if (zombies.length >= ZOMBIE_MAX) return;
    const pos = getRandomPathCell();
    if (!pos) return;
    zombies.push({
      x: pos.x,
      y: pos.y,
      spawnTime: Date.now(),
    });
  }

  function updateZombies(dt) {
    const now = Date.now();

    // Spawn zombies periodically
    if (now - lastZombieSpawn >= ZOMBIE_SPAWN_INTERVAL) {
      spawnZombie();
      lastZombieSpawn = now;
    }

    // Remove expired zombies (despawn after lifetime)
    for (let i = zombies.length - 1; i >= 0; i--) {
      if (now - zombies[i].spawnTime > ZOMBIE_LIFETIME) {
        zombies.splice(i, 1);
        continue;
      }

      // Check collision with players
      const z = zombies[i];
      [p1, p2].forEach((player) => {
        if (!player.alive || player.freezeTimer > 0) return;
        const pcx = player.x + PLAYER_SIZE / 2;
        const pcy = player.y + PLAYER_SIZE / 2;
        const dist = Math.hypot(z.x - pcx, z.y - pcy);
        if (dist <= ZOMBIE_HITBOX_RADIUS + PLAYER_SIZE / 2) {
          // Freeze the player
          player.freezeTimer = ZOMBIE_FREEZE_MS;
          // Remove this zombie on contact
          zombies.splice(i, 1);
        }
      });
    }

    // Count down freeze timers
    [p1, p2].forEach((player) => {
      if (player.freezeTimer > 0) {
        player.freezeTimer = Math.max(0, player.freezeTimer - dt);
      }
    });
  }

  // ---- Input State ----
  // Online: Both use WASD + Space (each on own machine)
  const keys = {};

  function handleKeyDown(e) {
    keys[e.code] = true;

    // Prevent scrolling from arrow keys / space
    if (GAME_CONFIG.INPUT.PREVENT_DEFAULT.includes(e.code)) {
      e.preventDefault();
    }

    // Restart on R when game over (host only)
    if (
      e.code === GAME_CONFIG.INPUT.RESTART &&
      gameState === STATE.GAME_OVER &&
      gameMode === "online-host"
    ) {
      restartGame();
    }
  }

  function handleKeyUp(e) {
    keys[e.code] = false;
  }

  // ---- Player Movement (key-based) ----
  function isAnyKeyDown(codes) {
    return codes.some((code) => keys[code]);
  }

  function processPlayerInput(player, up, down, left, right, shoot) {
    if (!player.alive) return;
    if (player.freezeTimer > 0) return; // frozen — no input

    let newX = player.x;
    let newY = player.y;
    let moved = false;

    if (isAnyKeyDown(up)) {
      newY -= PLAYER_SPEED;
      player.dir = { dx: 0, dy: -1 };
      moved = true;
    }
    if (isAnyKeyDown(down)) {
      newY += PLAYER_SPEED;
      player.dir = { dx: 0, dy: 1 };
      moved = true;
    }
    if (isAnyKeyDown(left)) {
      newX -= PLAYER_SPEED;
      player.dir = { dx: -1, dy: 0 };
      moved = true;
    }
    if (isAnyKeyDown(right)) {
      newX += PLAYER_SPEED;
      player.dir = { dx: 1, dy: 0 };
      moved = true;
    }

    // Try moving on each axis independently for smooth sliding along walls
    if (moved) {
      if (
        Physics.canMoveTo(newX, player.y) &&
        !collidesWithOtherPlayer(player, newX, player.y)
      ) {
        player.x = newX;
      }
      if (
        Physics.canMoveTo(player.x, newY) &&
        !collidesWithOtherPlayer(player, player.x, newY)
      ) {
        player.y = newY;
      }
    }

    // Shooting
    if (isAnyKeyDown(shoot)) {
      tryShoot(player);
    }
  }

  // ---- Remote Player Movement (from network input) ----
  function processRemoteInput(player) {
    if (!player.alive) return;
    if (player.freezeTimer > 0) return; // frozen — no input

    let newX = player.x;
    let newY = player.y;
    let moved = false;

    if (remoteInput.up) {
      newY -= PLAYER_SPEED;
      player.dir = { dx: 0, dy: -1 };
      moved = true;
    }
    if (remoteInput.down) {
      newY += PLAYER_SPEED;
      player.dir = { dx: 0, dy: 1 };
      moved = true;
    }
    if (remoteInput.left) {
      newX -= PLAYER_SPEED;
      player.dir = { dx: -1, dy: 0 };
      moved = true;
    }
    if (remoteInput.right) {
      newX += PLAYER_SPEED;
      player.dir = { dx: 1, dy: 0 };
      moved = true;
    }

    if (moved) {
      if (
        Physics.canMoveTo(newX, player.y) &&
        !collidesWithOtherPlayer(player, newX, player.y)
      ) {
        player.x = newX;
      }
      if (
        Physics.canMoveTo(player.x, newY) &&
        !collidesWithOtherPlayer(player, player.x, newY)
      ) {
        player.y = newY;
      }
    }

    if (remoteInput.shoot) {
      tryShoot(player);
    }
  }

  // ---- Check if new position collides with the other player ----
  function collidesWithOtherPlayer(player, newX, newY) {
    const other = player.id === 1 ? p2 : p1;
    if (!other.alive) return false;

    return Physics.rectsOverlap(
      { x: newX, y: newY, w: PLAYER_SIZE, h: PLAYER_SIZE },
      { x: other.x, y: other.y, w: PLAYER_SIZE, h: PLAYER_SIZE },
    );
  }

  // ---- Shooting ----
  function tryShoot(player) {
    const now = Date.now();
    if (now - player.lastShot < FIRE_RATE) return;

    player.lastShot = now;

    // Bullet spawns from center of player in their facing direction
    const cx = player.x + PLAYER_SIZE / 2;
    const cy = player.y + PLAYER_SIZE / 2;

    bullets.push({
      x: cx + player.dir.dx * (PLAYER_SIZE / 2 + BULLET_SIZE),
      y: cy + player.dir.dy * (PLAYER_SIZE / 2 + BULLET_SIZE),
      dx: player.dir.dx * BULLET_SPEED,
      dy: player.dir.dy * BULLET_SPEED,
      owner: player.id,
    });
  }

  // ---- Update Bullets ----
  function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.dx;
      b.y += b.dy;

      // Remove if out of bounds
      if (Physics.bulletOutOfBounds(b)) {
        bullets.splice(i, 1);
        continue;
      }

      // Remove if hits obstacle
      if (Physics.bulletHitsObstacle(b)) {
        bullets.splice(i, 1);
        continue;
      }

      // Validate bullet ownership — discard corrupted bullets
      if (b.owner !== 1 && b.owner !== 2) {
        bullets.splice(i, 1);
        continue;
      }

      // Check hit against players (can't hit own player)
      const target = b.owner === 1 ? p2 : p1;
      const shooter = b.owner === 1 ? p1 : p2;
      if (Physics.bulletHitsPlayer(b, target)) {
        target.health -= 1;
        bullets.splice(i, 1);

        // Check if killed
        if (target.health <= 0) {
          handlePlayerDeath(target, shooter);
        }
        continue;
      }
    }
  }

  // ---- Player Death & Respawn ----
  function handlePlayerDeath(deadPlayer, killer) {
    deadPlayer.alive = false;
    deadPlayer.respawnTimer = RESPAWN_TIME;
    deadPlayer.killedBy = killer; // remember killer for smart respawn
    killer.score += 1;

    // Check win
    if (killer.score >= WIN_SCORE) {
      gameState = STATE.GAME_OVER;
      winner = killer.id;
    }
  }

  function updateRespawns(dt) {
    [p1, p2].forEach((player) => {
      if (!player.alive && player.respawnTimer > 0) {
        player.respawnTimer -= dt;
        if (player.respawnTimer <= 0) {
          respawnPlayer(player, player.killedBy || null);
        }
      }
    });
  }

  function respawnPlayer(player, killer) {
    // Collect all spawn points from both pools
    const allSpawns = [...activeMaze.p1Spawns, ...activeMaze.p2Spawns];
    let spawn;

    if (killer && allSpawns.length > 1) {
      // Pick the spawn point farthest from the killer's current position
      let best = allSpawns[0];
      let bestDist = 0;
      for (const s of allSpawns) {
        const dx = s.x - killer.x;
        const dy = s.y - killer.y;
        const dist = dx * dx + dy * dy;
        if (dist > bestDist) {
          bestDist = dist;
          best = s;
        }
      }
      spawn = best;
    } else {
      // Fallback: use original per-player spawn logic
      spawn = getSpawn(player.id);
    }

    player.x = spawn.x;
    player.y = spawn.y;
    player.dir =
      player.id === 1 ? { ...DEFAULT_DIR_P1 } : { ...DEFAULT_DIR_P2 };
    player.health = PLAYER_HEALTH;
    player.alive = true;
    player.respawnTimer = 0;
    player.killedBy = null; // clear killer reference
  }

  // ---- Maze Rotation (cycle through all mazes) ----
  function checkMazeRotation() {
    const elapsed = Date.now() - mazeRotationStart;
    if (elapsed >= MAZE_ROTATION_MS) {
      rotateToNextMaze();
    }
  }

  function shuffleMazeOrder() {
    const keys = [...MAZE_KEYS];
    // Fisher-Yates shuffle
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    return keys;
  }

  function rotateToNextMaze() {
    mazesPlayed++;

    // All mazes played — time’s up!
    if (mazesPlayed >= MAZE_KEYS.length) {
      handleMatchTimeout();
      return;
    }

    const nextKey = mazeOrder[mazesPlayed];
    switchMaze(nextKey);
    Renderer.showMazeAnnouncement(activeMaze.name);
  }

  function handleMatchTimeout() {
    isDraw = false;
    if (p1.score > p2.score) {
      winner = 1;
    } else if (p2.score > p1.score) {
      winner = 2;
    } else {
      // Draw — pick the player with more health, or true draw
      winner = p1.health > p2.health ? 1 : p2.health > p1.health ? 2 : 0;
      if (winner === 0) isDraw = true;
    }
    gameState = STATE.GAME_OVER;
  }

  function switchMaze(mazeKey) {
    activeMaze = parseMaze(mazeKey);
    selectedMazeKey = mazeKey;
    mazeRotationStart = Date.now();

    // Respawn both players at new maze spawns, keep scores
    const spawn1 = getSpawn(1);
    const spawn2 = getSpawn(2);
    p1.x = spawn1.x;
    p1.y = spawn1.y;
    p1.health = PLAYER_HEALTH;
    p1.alive = true;
    p1.respawnTimer = 0;
    p1.dir = { ...DEFAULT_DIR_P1 };
    p2.x = spawn2.x;
    p2.y = spawn2.y;
    p2.health = PLAYER_HEALTH;
    p2.alive = true;
    p2.respawnTimer = 0;
    p2.dir = { ...DEFAULT_DIR_P2 };
    bullets = [];
    bombs = [];
    explosions = [];
    lastBombSpawn = Date.now();
    zombies = [];
    lastZombieSpawn = Date.now();

    // Update lobby selector highlight if visible
    highlightSelectedMaze();
  }

  function highlightSelectedMaze() {
    document.querySelectorAll(".maze-option").forEach((el) => {
      el.classList.toggle("selected", el.dataset.maze === selectedMazeKey);
    });
  }

  // ---- Countdown ----
  function startCountdown() {
    gameState = STATE.COUNTDOWN;
    countdownValue = COUNTDOWN_DURATION;
    countdownTimer = Date.now();
  }

  function updateCountdown() {
    const elapsed = Date.now() - countdownTimer;
    countdownValue = COUNTDOWN_DURATION - Math.floor(elapsed / 1000);

    if (countdownValue < 0) {
      gameState = STATE.PLAYING;
    }
  }

  // ---- Game Restart ----
  function restartGame() {
    p1 = createPlayer(1);
    p2 = createPlayer(2);
    bullets = [];
    bombs = [];
    explosions = [];
    lastBombSpawn = Date.now();
    zombies = [];
    lastZombieSpawn = Date.now();
    winner = null;
    isDraw = false;
    mazeOrder = shuffleMazeOrder();
    mazesPlayed = 0;
    selectedMazeKey = mazeOrder[0];
    activeMaze = parseMaze(selectedMazeKey);
    mazeRotationStart = Date.now();
    matchStartTime = Date.now();
    lastResync = Date.now();
    startCountdown();
  }

  // ======================================================
  // ---- Network Functions (Online Mode) ----
  // ======================================================

  // Guest sends WASD input to host every frame
  function sendLocalInput() {
    Network.send({
      type: "input",
      keys: {
        up: isAnyKeyDown(GAME_CONFIG.INPUT.MOVE_UP),
        down: isAnyKeyDown(GAME_CONFIG.INPUT.MOVE_DOWN),
        left: isAnyKeyDown(GAME_CONFIG.INPUT.MOVE_LEFT),
        right: isAnyKeyDown(GAME_CONFIG.INPUT.MOVE_RIGHT),
        shoot: isAnyKeyDown(GAME_CONFIG.INPUT.SHOOT),
      },
    });
  }

  // Host broadcasts full game state to guest every frame
  function broadcastState(fullSync) {
    const mazeElapsed = (Date.now() - mazeRotationStart) / 1000;
    const mazeTimeLeft = Math.max(0, MAZE_ROTATION_MS / 1000 - mazeElapsed);
    const totalMatchTime = (MAZE_KEYS.length * MAZE_ROTATION_MS) / 1000;
    const matchElapsed = (Date.now() - matchStartTime) / 1000;
    const matchTimeLeft = Math.max(0, totalMatchTime - matchElapsed);

    Network.send({
      type: fullSync ? "state_sync" : "state",
      p1: {
        x: p1.x,
        y: p1.y,
        dir: p1.dir,
        health: p1.health,
        alive: p1.alive,
        score: p1.score,
        respawnTimer: p1.respawnTimer,
        freezeTimer: p1.freezeTimer,
      },
      p2: {
        x: p2.x,
        y: p2.y,
        dir: p2.dir,
        health: p2.health,
        alive: p2.alive,
        score: p2.score,
        respawnTimer: p2.respawnTimer,
        freezeTimer: p2.freezeTimer,
      },
      bullets: bullets.map((b) => ({
        x: b.x,
        y: b.y,
        dx: b.dx,
        dy: b.dy,
        owner: b.owner,
      })),
      bombs: bombs.map((b) => ({ x: b.x, y: b.y, fuseLeft: b.fuseLeft })),
      explosions: explosions.map((e) => ({
        x: e.x,
        y: e.y,
        startTime: e.startTime,
      })),
      zombies: zombies.map((z) => ({ x: z.x, y: z.y, spawnTime: z.spawnTime })),
      gameState,
      winner,
      countdownValue,
      mazeKey: selectedMazeKey,
      mazeTimeLeft,
      matchTimeLeft,
      mazesPlayed,
      isDraw,
    });
  }

  // Guest applies received state from host
  function applyRemoteState(data) {
    // Detect maze change
    if (data.mazeKey && data.mazeKey !== selectedMazeKey) {
      activeMaze = parseMaze(data.mazeKey);
      selectedMazeKey = data.mazeKey;
      mazeRotationStart = Date.now();
      Renderer.showMazeAnnouncement(activeMaze.name);
    }

    // Apply player states
    p1.x = data.p1.x;
    p1.y = data.p1.y;
    p1.dir = data.p1.dir;
    p1.health = data.p1.health;
    p1.alive = data.p1.alive;
    p1.score = data.p1.score;
    p1.respawnTimer = data.p1.respawnTimer;

    p2.x = data.p2.x;
    p2.y = data.p2.y;
    p2.dir = data.p2.dir;
    p2.health = data.p2.health;
    p2.alive = data.p2.alive;
    p2.score = data.p2.score;
    p2.respawnTimer = data.p2.respawnTimer;

    bullets = data.bullets;
    if (data.bombs) bombs = data.bombs;
    if (data.explosions) explosions = data.explosions;
    if (data.zombies) zombies = data.zombies;
    // Sync freeze timers from player state
    if (data.p1.freezeTimer !== undefined) p1.freezeTimer = data.p1.freezeTimer;
    if (data.p2.freezeTimer !== undefined) p2.freezeTimer = data.p2.freezeTimer;
    gameState = data.gameState;
    winner = data.winner;
    countdownValue = data.countdownValue;
    displayMazeTimeLeft = data.mazeTimeLeft;
    if (data.matchTimeLeft !== undefined)
      displayMatchTimeLeft = data.matchTimeLeft;
    if (data.mazesPlayed !== undefined) mazesPlayed = data.mazesPlayed;
    if (data.isDraw !== undefined) isDraw = data.isDraw;
  }

  // Route incoming network data
  function handleNetworkData(data) {
    // Config is a one-time setup message — always handle it
    if (data.type === "config") {
      selectedMazeKey = data.mazeKey;
      activeMaze = parseMaze(data.mazeKey);
      // Use host's maze order so rotation and spawns stay in sync
      if (data.mazeOrder) {
        mazeOrder = data.mazeOrder;
      }
      startOnlineGame(false);
      return;
    }

    if (gameMode === "online-host") {
      // Host receives input from guest
      if (data.type === "input") {
        remoteInput = data.keys;
      }
    } else if (gameMode === "online-guest") {
      // Guest receives state from host
      if (data.type === "state" || data.type === "state_sync") {
        applyRemoteState(data);
      }
    }
  }

  // Handle peer disconnection
  function handleDisconnect() {
    if (isDisconnected) return; // already handling
    isDisconnected = true;

    // Return to lobby after a brief delay
    setTimeout(() => {
      returnToLobby();
    }, 3000);
  }

  // Return to lobby screen
  function returnToLobby() {
    Network.disconnect();
    gameMode = "lobby";
    gameState = STATE.LOBBY;
    isDisconnected = false;
    remoteInput = {
      up: false,
      down: false,
      left: false,
      right: false,
      shoot: false,
    };
    displayMazeTimeLeft = null;
    displayMatchTimeLeft = null;
    winner = null;
    isDraw = false;
    initialized = false;

    document.getElementById("lobby").style.display = "block";
    document.getElementById("connectionUI").style.display = "none";
    document.getElementById("gameContainer").style.display = "none";
    document.getElementById("controls-help").style.display = "none";
    document.getElementById("hostUI").style.display = "none";
    document.getElementById("joinUI").style.display = "none";
  }

  function buildShareLink(roomCode) {
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomCode);
    return url.toString();
  }

  function copyShareLink() {
    const linkEl = document.getElementById("shareLink");
    if (!linkEl) return;
    const url = linkEl.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    } else {
      const temp = document.createElement("input");
      temp.value = url;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand("copy");
      temp.remove();
    }
  }

  // ======================================================
  // ---- Online UI ----
  // ======================================================

  function showOnlineUI(mode) {
    document.getElementById("lobby").style.display = "none";
    document.getElementById("connectionUI").style.display = "block";

    if (mode === "host") {
      document.getElementById("hostUI").style.display = "block";
      document.getElementById("joinUI").style.display = "none";
      document.getElementById("connectionStatus").textContent =
        "Creating room...";
      document.getElementById("connectionStatus").className = "";

      Network.createHost({
        onReady: (roomCode) => {
          document.getElementById("roomCode").textContent = roomCode;
          const shareLink = document.getElementById("shareLink");
          const url = buildShareLink(roomCode);
          if (shareLink) {
            shareLink.href = url;
            shareLink.textContent = url;
          }
          document.getElementById("connectionStatus").textContent =
            "Waiting for opponent to join...";
        },
        onConnected: () => {
          document.getElementById("connectionStatus").textContent =
            "Opponent connected! Starting game...";
          document.getElementById("connectionStatus").className =
            "status-connected";

          // Start game as host, then send config to guest
          setTimeout(() => {
            startOnlineGame(true);
            // Send maze order so guest computes same deterministic spawns
            Network.send({
              type: "config",
              mazeKey: selectedMazeKey,
              mazeOrder: mazeOrder,
            });
          }, 500);
        },
        onData: handleNetworkData,
        onDisconnected: handleDisconnect,
        onError: (msg) => {
          document.getElementById("connectionStatus").textContent = msg;
          document.getElementById("connectionStatus").className =
            "status-error";
        },
      });
    } else {
      document.getElementById("hostUI").style.display = "none";
      document.getElementById("joinUI").style.display = "block";
      document.getElementById("joinStatus").textContent = "";
      document.getElementById("roomCodeInput").value = "";
      setTimeout(() => document.getElementById("roomCodeInput").focus(), 100);
    }
  }

  function joinOnlineGame() {
    const input = document.getElementById("roomCodeInput");
    const code = input.value.trim().toUpperCase();

    if (code.length < 4) {
      document.getElementById("joinStatus").textContent =
        "Enter a valid room code";
      document.getElementById("joinStatus").className = "status-error";
      return;
    }

    document.getElementById("joinStatus").textContent = "Connecting...";
    document.getElementById("joinStatus").className = "";

    Network.joinGame(code, {
      onConnected: () => {
        document.getElementById("joinStatus").textContent =
          "Connected! Waiting for host to start...";
        document.getElementById("joinStatus").className = "status-connected";
      },
      onData: handleNetworkData,
      onDisconnected: handleDisconnect,
      onError: (msg) => {
        document.getElementById("joinStatus").textContent = msg;
        document.getElementById("joinStatus").className = "status-error";
      },
    });
  }

  function cancelOnline() {
    Network.disconnect();
    document.getElementById("connectionUI").style.display = "none";
    document.getElementById("hostUI").style.display = "none";
    document.getElementById("joinUI").style.display = "none";
    document.getElementById("lobby").style.display = "block";
  }

  // ======================================================
  // ---- Main Game Loop ----
  // ======================================================
  let lastTime = 0;

  function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    // --- Update ---
    if (gameMode === "online-guest") {
      // Guest: only send input, state arrives via onData callback
      sendLocalInput();
    } else {
      // Host: run all physics
      if (gameState === STATE.COUNTDOWN) {
        updateCountdown();
      }

      if (gameState === STATE.PLAYING) {
        // Online host: P1 = host WASD, P2 = remote input
        processPlayerInput(
          p1,
          GAME_CONFIG.INPUT.MOVE_UP,
          GAME_CONFIG.INPUT.MOVE_DOWN,
          GAME_CONFIG.INPUT.MOVE_LEFT,
          GAME_CONFIG.INPUT.MOVE_RIGHT,
          GAME_CONFIG.INPUT.SHOOT,
        );
        processRemoteInput(p2);

        updateBullets();
        updateBombs(dt);
        updateZombies(dt);
        updateRespawns(dt);
        checkMazeRotation();
      }

      // Host broadcasts full state to guest each frame
      if (gameMode === "online-host") {
        const now = Date.now();
        const fullSync =
          now - lastResync >= GAME_CONFIG.NETWORK.RESYNC_INTERVAL_MS;
        broadcastState(fullSync);
        if (fullSync) {
          lastResync = now;
        }
      }
    }

    // --- Render (always, all modes) ---
    Renderer.drawArena();
    Renderer.drawMaze();
    Renderer.drawPlayer(p1, "P1");
    Renderer.drawPlayer(p2, "P2");
    Renderer.drawBullets(bullets);
    Renderer.drawBombs(bombs);
    Renderer.drawExplosions(explosions);
    Renderer.drawZombies(zombies);

    // Freeze effects
    if (p1.freezeTimer > 0) Renderer.drawFreezeEffect(p1);
    if (p2.freezeTimer > 0) Renderer.drawFreezeEffect(p2);

    // HUD — maze timer + match timer
    let mazeTimeLeft;
    let matchTimeLeft;
    if (gameMode === "online-guest" && displayMazeTimeLeft !== null) {
      mazeTimeLeft = displayMazeTimeLeft;
      matchTimeLeft = displayMatchTimeLeft != null ? displayMatchTimeLeft : 0;
    } else {
      const mazeElapsed = (Date.now() - mazeRotationStart) / 1000;
      mazeTimeLeft = Math.max(0, MAZE_ROTATION_MS / 1000 - mazeElapsed);
      const totalMatchTime = (MAZE_KEYS.length * MAZE_ROTATION_MS) / 1000;
      const matchElapsed = (Date.now() - matchStartTime) / 1000;
      matchTimeLeft = Math.max(0, totalMatchTime - matchElapsed);
    }
    Renderer.drawHUD(p1, p2, mazeTimeLeft, matchTimeLeft, mazesPlayed);

    // Respawn timers
    if (!p1.alive) Renderer.drawRespawnTimer(p1, p1.respawnTimer);
    if (!p2.alive) Renderer.drawRespawnTimer(p2, p2.respawnTimer);

    // Maze change announcement
    Renderer.drawMazeAnnouncement(dt);

    // Overlays
    if (gameState === STATE.COUNTDOWN) {
      Renderer.drawCountdown(countdownValue);
    }
    if (gameState === STATE.GAME_OVER) {
      Renderer.drawGameOver(
        winner,
        gameMode === "online-guest",
        p1,
        p2,
        isDraw,
      );
    }

    // Online connection indicator
    if (gameMode === "online-host" || gameMode === "online-guest") {
      Renderer.drawOnlineIndicator(Network.isConnected());
    }

    // Disconnect overlay (on top of everything)
    if (isDisconnected) {
      Renderer.drawDisconnected();
    }

    requestAnimationFrame(gameLoop);
  }

  // ---- Initialization ----
  function init() {
    if (initialized) return; // prevent double-adding listeners
    initialized = true;

    canvas = document.getElementById("gameCanvas");
    ctx = canvas.getContext("2d");
    resizeCanvas();

    Renderer.init(ctx);

    // Input listeners
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("resize", resizeCanvas);
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;

    const controls = document.getElementById("controls-help");
    const controlsVisible =
      controls && controls.style.display !== "none" && controls.offsetHeight;
    const controlsHeight = controlsVisible ? controls.offsetHeight : 0;

    const availableWidth = Math.max(
      1,
      window.innerWidth - GAME_CONFIG.VIEWPORT.SAFE_MARGIN * 2,
    );
    const availableHeight = Math.max(
      1,
      window.innerHeight -
        controlsHeight -
        GAME_CONFIG.VIEWPORT.SAFE_MARGIN * 2,
    );

    const scale = Math.min(
      availableWidth / CANVAS_WIDTH,
      availableHeight / CANVAS_HEIGHT,
      GAME_CONFIG.VIEWPORT.MAX_SCALE,
    );
    const dpr = window.devicePixelRatio || 1;

    const displayWidth = Math.max(1, Math.floor(CANVAS_WIDTH * scale));
    const displayHeight = Math.max(1, Math.floor(CANVAS_HEIGHT * scale));

    canvas.width = Math.floor(displayWidth * dpr);
    canvas.height = Math.floor(displayHeight * dpr);
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }

  // ---- Select maze from lobby ----
  function selectMaze(mazeKey) {
    if (MAZES[mazeKey]) {
      selectedMazeKey = mazeKey;
      activeMaze = parseMaze(mazeKey);
      highlightSelectedMaze();
    }
  }

  // ---- Update controls help text based on mode ----
  function updateControlsHelp() {
    const help = document.getElementById("controls-help");
    if (!help) return;

    if (gameMode === "online-host") {
      help.innerHTML = `
        <span><strong style="color: #00d4ff">You (P1):</strong>
          <span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span>
          or <span class="key">↑</span><span class="key">←</span><span class="key">↓</span><span class="key">→</span> move ·
          <span class="key">Space</span> shoot</span>
        <span><span class="key">R</span> restart</span>
      `;
    } else if (gameMode === "online-guest") {
      help.innerHTML = `
        <span><strong style="color: #ff4444">You (P2):</strong>
          <span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span>
          or <span class="key">↑</span><span class="key">←</span><span class="key">↓</span><span class="key">→</span> move ·
          <span class="key">Space</span> shoot</span>
      `;
    } else {
      help.innerHTML = "";
    }
  }

  // ---- Start online game (Phase 3) ----
  function startOnlineGame(isHost) {
    gameMode = isHost ? "online-host" : "online-guest";
    isDisconnected = false;
    // Only host shuffles maze order; guest receives it via config message
    if (isHost) {
      mazeOrder = shuffleMazeOrder();
    }
    mazesPlayed = 0;
    selectedMazeKey = mazeOrder[0];
    activeMaze = parseMaze(selectedMazeKey);
    mazeRotationStart = Date.now();
    matchStartTime = Date.now();

    // Hide UI, show game
    document.getElementById("lobby").style.display = "none";
    document.getElementById("connectionUI").style.display = "none";
    document.getElementById("gameContainer").style.display = "flex";
    document.getElementById("controls-help").style.display = "block";
    updateControlsHelp();
    resizeCanvas();
    resizeCanvas();

    // Create players
    p1 = createPlayer(1);
    p2 = createPlayer(2);
    bullets = [];
    bombs = [];
    explosions = [];
    lastBombSpawn = Date.now();
    zombies = [];
    lastZombieSpawn = Date.now();

    init();
    startCountdown();
    lastResync = Date.now();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }

  return {
    init,
    startOnlineGame,
    restartGame,
    selectMaze,
    showOnlineUI,
    joinOnlineGame,
    cancelOnline,
    copyShareLink,
    returnToLobby,
    getState: () => ({ p1, p2, bullets, gameState, winner, gameMode }),
  };
})();
