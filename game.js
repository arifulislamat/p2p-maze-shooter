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
      RECONNECT_TIMEOUT_MS: 75000, // must outlast PeerJS server's ~60s peer expiry
      RECONNECT_INTERVAL_MS: 3000,
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
  let isReconnecting = false;
  let reconnectDeadline = 0;
  let reconnectIntervalTimer = null;
  let displayMazeTimeLeft = null;
  let displayMatchTimeLeft = null;
  let initialized = false;
  let lastResync = 0;
  let lobbyRetryCount = 0;
  const LOBBY_MAX_RETRIES = 5;
  let lastDataReceived = 0;
  const DATA_TIMEOUT_MS = 5000;
  let lastCorrection = 0;
  const CORRECTION_INTERVAL_MS = 100; // 10 Hz authority corrections
  // Holds saved game state to restore after host page reload
  let pendingResumeState = null;
  // Host-authoritative player states received at 60 Hz (guest applies directly)
  let hostP1State = null;
  let hostP2State = null;

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

  function updateBombs(dt, skipSpawn) {
    const now = Date.now();

    // Spawn new bombs periodically (host only)
    if (!skipSpawn && now - lastBombSpawn >= BOMB_SPAWN_INTERVAL) {
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
    Sound.play("explosion", bomb.x, bomb.y);

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

  function updateZombies(dt, skipSpawn) {
    const now = Date.now();

    // Spawn zombies periodically (host only)
    if (!skipSpawn && now - lastZombieSpawn >= ZOMBIE_SPAWN_INTERVAL) {
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
          Sound.play("freeze", player.x, player.y);
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
    Sound.play("shoot", player.x, player.y);
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
        Sound.play("hit", target.x, target.y);

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
    Sound.play("death", deadPlayer.x, deadPlayer.y);

    // Check win
    if (killer.score >= WIN_SCORE) {
      gameState = STATE.GAME_OVER;
      winner = killer.id;
      Sound.play("victory", killer.x, killer.y);
      clearSession(); // don't persist a finished game
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
    Sound.play("respawn", player.x, player.y);
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
    Sound.play("mazeChange", CONFIG.CANVAS.WIDTH / 2, CONFIG.CANVAS.HEIGHT / 2);
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
    Sound.play("gameOver", CONFIG.CANVAS.WIDTH / 2, CONFIG.CANVAS.HEIGHT / 2);
    clearSession(); // don't persist a finished game
  }

  function switchMaze(mazeKey) {
    activeMaze = parseMaze(mazeKey);
    selectedMazeKey = mazeKey;
    Renderer.invalidateMazeCache();
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

  let prevCountdownValue = -1;

  function updateCountdown() {
    const elapsed = Date.now() - countdownTimer;
    countdownValue = COUNTDOWN_DURATION - Math.floor(elapsed / 1000);

    // Play countdown sounds only on value change
    if (countdownValue !== prevCountdownValue) {
      prevCountdownValue = countdownValue;
      if (countdownValue > 0 && countdownValue <= COUNTDOWN_DURATION) {
        Sound.play(
          "countdown",
          CONFIG.CANVAS.WIDTH / 2,
          CONFIG.CANVAS.HEIGHT / 2,
        );
      }
    }

    if (countdownValue < 0) {
      if (prevCountdownValue >= 0) {
        Sound.play("go", CONFIG.CANVAS.WIDTH / 2, CONFIG.CANVAS.HEIGHT / 2);
        prevCountdownValue = -1;
      }
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
    Renderer.invalidateMazeCache();
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

  // Host sends its input + authoritative positions to guest every frame.
  // Host keys → guest simulates P1 locally (for shooting); positions → guest
  // feeds interpolation buffers for jitter-free rendering of both players.
  function sendHostInput() {
    Network.send({
      type: "host_input",
      keys: {
        up: isAnyKeyDown(GAME_CONFIG.INPUT.MOVE_UP),
        down: isAnyKeyDown(GAME_CONFIG.INPUT.MOVE_DOWN),
        left: isAnyKeyDown(GAME_CONFIG.INPUT.MOVE_LEFT),
        right: isAnyKeyDown(GAME_CONFIG.INPUT.MOVE_RIGHT),
        shoot: isAnyKeyDown(GAME_CONFIG.INPUT.SHOOT),
      },
      p1: { x: p1.x, y: p1.y, dir: p1.dir },
      p2: { x: p2.x, y: p2.y, dir: p2.dir },
    });
  }

  // Host sends lightweight authority corrections at 10 Hz
  function sendCorrections() {
    // Persist state at 10 Hz so a host page reload can resume mid-match
    // (but not if game is over — session was already cleared)
    const code = Network.getLastRoomCode();
    if (code && gameState !== STATE.GAME_OVER) {
      saveSession("host", code, {
        mazeOrder,
        selectedMazeKey,
        mazesPlayed,
        matchStartTime,
        mazeRotationStart,
        p1Score: p1.score,
        p2Score: p2.score,
      });
    }
    const corrNow = Date.now();
    const mazeElapsed = (corrNow - mazeRotationStart) / 1000;
    const mazeTimeLeft = Math.max(0, MAZE_ROTATION_MS / 1000 - mazeElapsed);
    const totalMatchTime = (MAZE_KEYS.length * MAZE_ROTATION_MS) / 1000;
    const matchElapsed = (corrNow - matchStartTime) / 1000;
    const matchTimeLeft = Math.max(0, totalMatchTime - matchElapsed);

    Network.send({
      type: "correction",
      mazeRotationStart: mazeRotationStart,
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
      bombs: bombs.map((b) => ({ x: b.x, y: b.y, fuseLeft: b.fuseLeft })),
      explosions: explosions.map((e) => ({
        x: e.x,
        y: e.y,
        elapsed: corrNow - e.startTime,
      })),
      zombies: zombies.map((z) => ({ x: z.x, y: z.y, elapsed: corrNow - z.spawnTime })),
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

  // Host broadcasts full game state to guest every frame
  function broadcastState(fullSync) {
    const broadcastNow = Date.now();
    const mazeElapsed = (broadcastNow - mazeRotationStart) / 1000;
    const mazeTimeLeft = Math.max(0, MAZE_ROTATION_MS / 1000 - mazeElapsed);
    const totalMatchTime = (MAZE_KEYS.length * MAZE_ROTATION_MS) / 1000;
    const matchElapsed = (Date.now() - matchStartTime) / 1000;
    const matchTimeLeft = Math.max(0, totalMatchTime - matchElapsed);

    Network.send({
      type: fullSync ? "state_sync" : "state",
      mazeRotationStart: mazeRotationStart,
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
        elapsed: broadcastNow - e.startTime,
      })),
      zombies: zombies.map((z) => ({ x: z.x, y: z.y, elapsed: broadcastNow - z.spawnTime })),
      gameState,
      winner,
      countdownValue,
      mazeKey: selectedMazeKey,
      mazeTimeLeft,
      matchTimeLeft,
      mazesPlayed,
      isDraw,
      sounds: Sound.flushPending(),
    });
  }

  // Guest applies received state from host
  function applyRemoteState(data) {
    // Detect maze change
    if (data.mazeKey && data.mazeKey !== selectedMazeKey) {
      activeMaze = parseMaze(data.mazeKey);
      selectedMazeKey = data.mazeKey;
      Renderer.invalidateMazeCache();
      Renderer.showMazeAnnouncement(activeMaze.name);
    }

    // Sync maze rotation timestamp from host (avoids local Date.now() desync)
    if (data.mazeRotationStart !== undefined) {
      mazeRotationStart = data.mazeRotationStart;
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
    // Convert elapsed times to local timestamps to avoid host/guest clock skew
    if (data.explosions) {
      const recvNow = Date.now();
      explosions = data.explosions.map((e) => ({
        x: e.x, y: e.y,
        startTime: e.startTime !== undefined ? e.startTime : recvNow - (e.elapsed || 0),
      }));
    }
    if (data.zombies) {
      const recvNow = Date.now();
      zombies = data.zombies.map((z) => ({
        x: z.x, y: z.y,
        spawnTime: z.spawnTime !== undefined ? z.spawnTime : recvNow - (z.elapsed || 0),
      }));
    }
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

    // Play sound events from host
    if (data.sounds && data.sounds.length > 0) {
      Sound.playRemote(data.sounds);
    }

    // Seed host position state from the synced positions
    hostP1State = { x: data.p1.x, y: data.p1.y, dir: data.p1.dir };
    hostP2State = { x: data.p2.x, y: data.p2.y, dir: data.p2.dir };
  }

  // Guest applies lightweight host corrections (10 Hz).
  // Positions are applied directly (both players received at 60 Hz via host_input).
  // Authority state (health, score, alive, game state) is snapped immediately.

  function applyCorrections(data) {
    // Detect maze change (host rotated to a new maze)
    if (data.mazeKey && data.mazeKey !== selectedMazeKey) {
      activeMaze = parseMaze(data.mazeKey);
      selectedMazeKey = data.mazeKey;
      Renderer.invalidateMazeCache();
      Renderer.showMazeAnnouncement(activeMaze.name);
      Sound.play("mazeChange", CONFIG.CANVAS.WIDTH / 2, CONFIG.CANVAS.HEIGHT / 2);
    }

    // Sync maze rotation timestamp
    if (data.mazeRotationStart !== undefined) {
      mazeRotationStart = data.mazeRotationStart;
    }

    // Update host position state from corrections (backup at 10 Hz;
    // primary 60 Hz data comes from host_input).
    hostP1State = { x: data.p1.x, y: data.p1.y, dir: data.p1.dir };
    hostP2State = { x: data.p2.x, y: data.p2.y, dir: data.p2.dir };

    // Authority state — snap immediately for both players
    [
      { local: p1, remote: data.p1 },
      { local: p2, remote: data.p2 },
    ].forEach(({ local, remote }) => {
      local.health = remote.health;
      local.alive = remote.alive;
      local.score = remote.score;
      local.respawnTimer = remote.respawnTimer;
      if (remote.freezeTimer !== undefined) local.freezeTimer = remote.freezeTimer;
    });

    // Host-only entities — guest doesn't spawn these, accept host data
    if (data.bombs) bombs = data.bombs;
    // Convert elapsed times to local timestamps to avoid host/guest clock skew
    if (data.explosions) {
      const recvNow = Date.now();
      explosions = data.explosions.map((e) => ({
        x: e.x, y: e.y,
        startTime: e.startTime !== undefined ? e.startTime : recvNow - (e.elapsed || 0),
      }));
    }
    if (data.zombies) {
      const recvNow = Date.now();
      zombies = data.zombies.map((z) => ({
        x: z.x, y: z.y,
        spawnTime: z.spawnTime !== undefined ? z.spawnTime : recvNow - (z.elapsed || 0),
      }));
    }

    // Game state authority
    gameState = data.gameState;
    winner = data.winner;
    countdownValue = data.countdownValue;
    if (data.mazeTimeLeft !== undefined) displayMazeTimeLeft = data.mazeTimeLeft;
    if (data.matchTimeLeft !== undefined) displayMatchTimeLeft = data.matchTimeLeft;
    if (data.mazesPlayed !== undefined) mazesPlayed = data.mazesPlayed;
    if (data.isDraw !== undefined) isDraw = data.isDraw;
  }



  // ---- Render Interpolation Helpers ----
  // Save physics positions before each tick so the renderer can interpolate
  // between the previous and current state for sub-tick smoothness.
  function savePhysicsPositions() {
    // Players: only save for host/local (physics-driven).
    // Guest receives positions directly from host — no sub-frame interpolation.
    if (gameMode !== "online-guest") {
      p1.prevX = p1.x; p1.prevY = p1.y;
      p2.prevX = p2.x; p2.prevY = p2.y;
    }
    for (let i = 0; i < bullets.length; i++) {
      bullets[i].prevX = bullets[i].x;
      bullets[i].prevY = bullets[i].y;
    }
  }

  function interpolateForRender(alpha) {
    // Players: only interpolate for host/local (physics-driven).
    // Guest applies host positions directly every frame — skip interpolation
    // to avoid fighting the network-received positions.
    if (gameMode !== "online-guest") {
      p1._physX = p1.x; p1._physY = p1.y;
      p2._physX = p2.x; p2._physY = p2.y;
      if (p1.prevX !== undefined) {
        p1.x = p1.prevX + (p1.x - p1.prevX) * alpha;
        p1.y = p1.prevY + (p1.y - p1.prevY) * alpha;
      }
      if (p2.prevX !== undefined) {
        p2.x = p2.prevX + (p2.x - p2.prevX) * alpha;
        p2.y = p2.prevY + (p2.y - p2.prevY) * alpha;
      }
    }
    // Bullets
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      b._physX = b.x; b._physY = b.y;
      if (b.prevX !== undefined) {
        b.x = b.prevX + (b.x - b.prevX) * alpha;
        b.y = b.prevY + (b.y - b.prevY) * alpha;
      }
    }
  }

  function restorePhysicsPositions() {
    if (gameMode !== "online-guest") {
      p1.x = p1._physX; p1.y = p1._physY;
      p2.x = p2._physX; p2.y = p2._physY;
    }
    for (let i = 0; i < bullets.length; i++) {
      bullets[i].x = bullets[i]._physX;
      bullets[i].y = bullets[i]._physY;
    }
  }

  // Route incoming network data
  function handleNetworkData(data) {
    lastDataReceived = Date.now();
    // Config is a one-time setup message — always handle it
    if (data.type === "config") {
      selectedMazeKey = data.mazeKey;
      activeMaze = parseMaze(data.mazeKey);
      Renderer.invalidateMazeCache();
      // Use host's maze order so rotation and spawns stay in sync
      if (data.mazeOrder) {
        mazeOrder = data.mazeOrder;
      }
      startOnlineGame(false);
      return;
    }

    // Resync after reconnection — update maze state without resetting match
    if (data.type === "resync") {
      if (data.mazeKey && data.mazeKey !== selectedMazeKey) {
        selectedMazeKey = data.mazeKey;
        activeMaze = parseMaze(data.mazeKey);
        Renderer.invalidateMazeCache();
      }
      if (data.mazeOrder) mazeOrder = data.mazeOrder;
      if (data.mazesPlayed !== undefined) mazesPlayed = data.mazesPlayed;
      if (data.matchStartTime !== undefined) matchStartTime = data.matchStartTime;
      if (data.mazeRotationStart !== undefined) mazeRotationStart = data.mazeRotationStart;
      return;
    }

    // Guest (re)joined mid-game — bootstrap them into the running match.
    // Send config so the guest calls startOnlineGame(), then resync + full
    // state so it converges to the current match state.
    if (data.type === "ready" && gameMode === "online-host") {
      console.log("[Game] Guest sent 'ready' while game is running — bootstrapping");
      Network.send({
        type: "config",
        mazeKey: selectedMazeKey,
        mazeOrder: mazeOrder,
      });
      Network.send({
        type: "resync",
        mazeKey: selectedMazeKey,
        mazeOrder: mazeOrder,
        mazesPlayed: mazesPlayed,
        matchStartTime: matchStartTime,
        mazeRotationStart: mazeRotationStart,
      });
      broadcastState(true);
      return;
    }

    if (gameMode === "online-host") {
      // Host receives input from guest
      if (data.type === "input") {
        remoteInput = data.keys;
      }
    } else if (gameMode === "online-guest") {
      // Guest receives host's input + authoritative positions (60 Hz)
      if (data.type === "host_input") {
        remoteInput = data.keys;
        if (data.p1) hostP1State = data.p1;
        if (data.p2) hostP2State = data.p2;
      }
      // Guest receives authority corrections from host (10 Hz)
      if (data.type === "correction") {
        applyCorrections(data);
      }
      // Backward compat: full state (used after reconnection broadcastState)
      if (data.type === "state" || data.type === "state_sync") {
        applyRemoteState(data);
      }
    }
  }

  // Handle peer disconnection
  function handleDisconnect() {
    if (isDisconnected || isReconnecting) return;

    // During active online play, try to reconnect before giving up
    if (gameMode === "online-host" || gameMode === "online-guest") {
      startReconnecting();
    } else {
      isDisconnected = true;
      setTimeout(() => returnToLobby(), 3000);
    }
  }

  // ---- Reconnection state machine ----
  function startReconnecting() {
    isReconnecting = true;
    reconnectDeadline = Date.now() + GAME_CONFIG.NETWORK.RECONNECT_TIMEOUT_MS;
    console.log("[Game] Entering RECONNECTING state, 30s window");
    attemptReconnect();
    reconnectIntervalTimer = setInterval(() => {
      if (!isReconnecting) return;
      if (Date.now() >= reconnectDeadline) {
        stopReconnecting();
        isDisconnected = true;
        setTimeout(() => returnToLobby(), 3000);
        return;
      }
      attemptReconnect();
    }, GAME_CONFIG.NETWORK.RECONNECT_INTERVAL_MS);
  }

  function stopReconnecting() {
    isReconnecting = false;
    if (reconnectIntervalTimer) {
      clearInterval(reconnectIntervalTimer);
      reconnectIntervalTimer = null;
    }
  }

  function attemptReconnect() {
    const roomCode = Network.getLastRoomCode();
    if (!roomCode) return;
    console.log("[Game] Reconnect attempt as", gameMode);

    const cbs = {
      onReady: () => {
        // Host peer is back up — room link is live again, waiting for guest
        console.log("[Game] Reconnect: host peer ready, awaiting guest...");
      },
      onConnected: () => {
        console.log("[Game] Reconnect successful!");
        stopReconnecting();
        // Re-send resync so guest can restore maze state without resetting match
        if (gameMode === "online-host") {
          Network.send({
            type: "resync",
            mazeKey: selectedMazeKey,
            mazeOrder: mazeOrder,
            mazesPlayed: mazesPlayed,
            matchStartTime: matchStartTime,
            mazeRotationStart: mazeRotationStart,
          });
          // Immediately follow with a full state update so guest has positions
          broadcastState(true);
        }
        // Guest: tell host we're ready (host may have reloaded and is in lobby
        // waiting for the "ready" handshake before starting the game)
        if (gameMode === "online-guest") {
          Network.send({ type: "ready" });
        }
      },
      onData: handleNetworkData,
      onDisconnected: handleDisconnect,
      onPeerClosed: () => {
        // Peer fully destroyed (not just WS drop), let interval retry
        console.warn("[Game] Peer closed during reconnect window");
      },
      onError: (msg) => {
        console.warn("[Game] Reconnect attempt error:", msg);
        // Interval will retry automatically
      },
    };

    if (gameMode === "online-host") {
      Network.restoreHost(roomCode, cbs);
    } else {
      Network.restoreGuest(roomCode, cbs);
    }
  }

  // ---- Page visibility: proactively reconnect on foreground ----
  function handleVisibilityChange() {
    if (document.visibilityState !== "visible") return;

    // Mid-game reconnection
    if (gameMode === "online-host" || gameMode === "online-guest") {
      if (isReconnecting) return; // already recovering
      if (Network.isConnected()) return; // still alive
      console.log("[Game] Tab foregrounded — connection lost while backgrounded, reconnecting");
      startReconnecting();
      return;
    }

    // Lobby phase: if we were waiting for opponent and peer died while backgrounded,
    // re-register with the same room code
    if (Network.getIsHost() && Network.getLastRoomCode() && !Network.isConnected()) {
      console.log("[Game] Tab foregrounded in lobby — re-registering room");
      const code = Network.getLastRoomCode();
      // Small delay to let PeerJS server expire old ID
      document.getElementById("connectionStatus").textContent = "Reconnecting room...";
      document.getElementById("connectionStatus").style.display = "";
      setTimeout(() => setupHostRoom(code), 2000);
    }
  }

  // Return to lobby screen
  // ---- Session persistence (survives page reload) ----
  const SESSION_KEY = "p2p-maze-shooter";

  function saveSession(role, roomCode, extra) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role, roomCode, ...(extra || {}) }));
    } catch (_) { /* private browsing / quota */ }
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
  }

  function getSavedSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s && s.role && s.roomCode) return s;
    } catch (_) {}
    return null;
  }

  function returnToLobby() {
    clearSession();
    stopReconnecting();
    Network.disconnect();
    gameMode = "lobby";
    gameState = STATE.LOBBY;
    isDisconnected = false;
    isReconnecting = false;
    lobbyRetryCount = 0;
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
    // Brief "Copied!" feedback on the button
    const copyBtn = document.getElementById("copyLinkBtn");
    if (copyBtn) {
      const original = copyBtn.textContent;
      copyBtn.textContent = "✓ Copied!";
      setTimeout(() => { copyBtn.textContent = original; }, 1500);
    }
  }

  // ======================================================
  // ---- Online UI ----
  // ======================================================

  // ---- Build and launch (or re-launch) a host room ----
  // Pass existingCode to reuse the same room code (e.g. after a drop while
  // waiting in lobby). Pass null/undefined to generate a fresh code.
  function setupHostRoom(existingCode, freshCreate) {
    const isRetry = !!existingCode && !freshCreate;
    document.getElementById("connectionStatus").textContent = isRetry
      ? "Reconnecting room..."
      : "Creating room...";
    document.getElementById("connectionStatus").className = "";

    // Guard to prevent onPeerClosed from scheduling a second retry when
    // onError has already queued one (e.g. after unavailable-id, PeerJS
    // auto-destroys the peer which fires both callbacks).
    let retryScheduled = false;

    const hostCallbacks = {
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
        lobbyRetryCount = 0;
        document.getElementById("connectionStatus").textContent =
          "Opponent connected! Waiting for ready signal...";
        document.getElementById("connectionStatus").className = "status-connected";
        // Don't start yet — wait for guest's "ready" message
      },
      onData: (data) => {
        if (data.type === "ready") {
          // Guest is ready — start the game (works both from lobby and mid-game)
          if (gameMode === "online-host") {
            // Already running — let handleNetworkData bootstrap the guest
            handleNetworkData(data);
          } else {
            // First start (or host reload resume) — launch the match
            document.getElementById("connectionStatus").textContent = "Starting game...";
            setTimeout(() => {
              startOnlineGame(true);
              Network.send({
                type: "config",
                mazeKey: selectedMazeKey,
                mazeOrder: mazeOrder,
              });
              // Always follow with resync + full state so guest gets correct
              // maze progress and scores (critical after host page reload)
              Network.send({
                type: "resync",
                mazeKey: selectedMazeKey,
                mazeOrder: mazeOrder,
                mazesPlayed: mazesPlayed,
                matchStartTime: matchStartTime,
                mazeRotationStart: mazeRotationStart,
              });
              broadcastState(true);
            }, 300);
          }
          return;
        }
        handleNetworkData(data);
      },
      // While still waiting in lobby, auto-relaunch with the same room code
      // instead of tearing down to the lobby screen.
      onDisconnected: () => {
        const code = Network.getLastRoomCode();
        if (
          (gameMode !== "online-host" && gameMode !== "online-guest") &&
          code
        ) {
          lobbyRetryCount++;
          if (lobbyRetryCount > LOBBY_MAX_RETRIES) {
            document.getElementById("connectionStatus").textContent =
              "Failed to create room. Please try again.";
            document.getElementById("connectionStatus").className = "status-error";
            lobbyRetryCount = 0;
            return;
          }
          console.log(
            "[Game] Host lobby disconnect — relaunching same room (" + lobbyRetryCount + "/" + LOBBY_MAX_RETRIES + "):",
            code,
          );
          setTimeout(() => setupHostRoom(code), 1500);
        } else {
          handleDisconnect();
        }
      },
      onPeerClosed: () => {
        if (retryScheduled) return; // onError already has a retry in flight
        const code = Network.getLastRoomCode();
        if (
          (gameMode !== "online-host" && gameMode !== "online-guest") &&
          code
        ) {
          lobbyRetryCount++;
          if (lobbyRetryCount > LOBBY_MAX_RETRIES) {
            document.getElementById("connectionStatus").textContent =
              "Failed to create room. Please try again.";
            document.getElementById("connectionStatus").className = "status-error";
            lobbyRetryCount = 0;
            return;
          }
          console.log("[Game] Host peer closed in lobby — relaunching (" + lobbyRetryCount + "/" + LOBBY_MAX_RETRIES + "):", code);
          setTimeout(() => setupHostRoom(code), 1500);
        } else {
          handleDisconnect();
        }
      },
      onError: (msg) => {
        const code = Network.getLastRoomCode();
        const isIdTaken = msg === "Room code already in use. Try again.";
        // In lobby (not mid-game), retry for all transient errors.
        // unavailable-id means the server still has our stale peer ID registered
        // (e.g. the TCP connection was abruptly dropped when the app was
        // backgrounded and the server hasn't expired it yet). Retry silently
        // with a slightly longer delay to give the server time to release it.
        if (code && gameMode !== "online-host" && gameMode !== "online-guest") {
          lobbyRetryCount++;
          if (lobbyRetryCount > LOBBY_MAX_RETRIES) {
            document.getElementById("connectionStatus").textContent =
              "Failed to create room. Please try again.";
            document.getElementById("connectionStatus").className = "status-error";
            lobbyRetryCount = 0;
            return;
          }
          console.warn("[Game] Host lobby error — retrying (" + lobbyRetryCount + "/" + LOBBY_MAX_RETRIES + "):", msg);
          document.getElementById("connectionStatus").textContent = isIdTaken
            ? "Reconnecting room... (" + lobbyRetryCount + "/" + LOBBY_MAX_RETRIES + ")"
            : "Connection error. Retrying... (" + lobbyRetryCount + "/" + LOBBY_MAX_RETRIES + ")";
          document.getElementById("connectionStatus").className = "";
          retryScheduled = true;
          setTimeout(() => setupHostRoom(code), isIdTaken ? 3000 : 2000);
        } else {
          document.getElementById("connectionStatus").textContent = msg;
          document.getElementById("connectionStatus").className =
            "status-error";
        }
      },
    };

    if (existingCode && !freshCreate) {
      Network.restoreHost(existingCode, hostCallbacks);
    } else if (existingCode && freshCreate) {
      Network.createHostWithCode(existingCode, hostCallbacks);
    } else {
      Network.createHost(hostCallbacks);
    }
  }

  function showOnlineUI(mode) {
    document.getElementById("lobby").style.display = "none";
    document.getElementById("connectionUI").style.display = "block";

    if (mode === "host") {
      document.getElementById("hostUI").style.display = "block";
      document.getElementById("joinUI").style.display = "none";
      // Generate room code, show share link, and immediately start PeerJS
      const roomCode = Network.generateRoomCode();
      Network.setLastRoomCode(roomCode);
      document.getElementById("roomCode").textContent = roomCode;
      const shareLink = document.getElementById("shareLink");
      const url = buildShareLink(roomCode);
      if (shareLink) {
        shareLink.href = url;
        shareLink.textContent = url;
      }
      document.getElementById("connectionStatus").style.display = "";
      document.getElementById("connectionStatus").textContent = "Creating room...";
      document.getElementById("connectionStatus").className = "";
      lobbyRetryCount = 0;
      setupHostRoom(roomCode, true);
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

    if (code.length !== 6) {
      document.getElementById("joinStatus").textContent =
        "Room code must be 6 characters";
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
        // Tell host we're ready to receive
        Network.send({ type: "ready" });
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
    clearSession();
    Network.disconnect();
    document.getElementById("connectionUI").style.display = "none";
    document.getElementById("hostUI").style.display = "none";
    document.getElementById("joinUI").style.display = "none";
    document.getElementById("lobby").style.display = "block";
    lobbyRetryCount = 0;
    document.getElementById("connectionStatus").style.display = "none";
  }

  // ======================================================
  // ---- Main Game Loop ----
  // ======================================================
  const PHYSICS_STEP_MS = 1000 / 60; // fixed 60 Hz physics tick
  let physicsAccumulator = 0;
  let lastTime = 0;

  function gameLoop(timestamp) {
    const rawDt = timestamp - lastTime;
    lastTime = timestamp;

    // Accumulate wall-clock time; cap at 100 ms to avoid spiral-of-death
    // after tab visibility changes or slow frames.
    physicsAccumulator += Math.min(rawDt, 100);
    const runPhysics = physicsAccumulator >= PHYSICS_STEP_MS;
    if (runPhysics) {
      physicsAccumulator -= PHYSICS_STEP_MS;
      // If we've fallen behind by more than one extra step, discard the
      // surplus rather than catch-up and run physics multiple times fast.
      if (physicsAccumulator >= PHYSICS_STEP_MS) physicsAccumulator = 0;

      // Snapshot positions BEFORE physics for render interpolation
      savePhysicsPositions();
    }

    // --- Update ---
    if (gameMode === "online-guest") {
      // Guest physics: bullets/bombs/zombies at 60 Hz; positions from host.
      if (runPhysics) {
        sendLocalInput();
        if (gameState === STATE.COUNTDOWN) {
          updateCountdown();
        }
        if (gameState === STATE.PLAYING) {
          // P1: process host's key input for responsive bullet creation.
          // Position will be overridden below by authoritative host state.
          processRemoteInput(p1);

          // P2: guest handles shooting locally for responsive bullet creation.
          if (p2.alive && p2.freezeTimer <= 0 && isAnyKeyDown(GAME_CONFIG.INPUT.SHOOT)) {
            tryShoot(p2);
          }

          updateBullets();
          updateBombs(PHYSICS_STEP_MS, true);
          updateZombies(PHYSICS_STEP_MS, true);
          updateRespawns(PHYSICS_STEP_MS);
        }
      }

      // Apply authoritative host positions EVERY frame (not gated by physics)
      // so rendering is as smooth as the display refresh rate — the same
      // "dumb terminal" model used pre-632e3da that the user found smooth.
      if (hostP1State) {
        p1.x = hostP1State.x;
        p1.y = hostP1State.y;
        p1.dir = hostP1State.dir;
      }
      if (hostP2State) {
        p2.x = hostP2State.x;
        p2.y = hostP2State.y;
        p2.dir = hostP2State.dir;
      }
    } else if (runPhysics) {
      // Host / local: run all physics at fixed 60 Hz
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
        updateBombs(PHYSICS_STEP_MS);
        updateZombies(PHYSICS_STEP_MS);
        updateRespawns(PHYSICS_STEP_MS);
        checkMazeRotation();
      }

      // Host: send input to guest every tick (60Hz) + corrections at 10Hz
      if (gameMode === "online-host") {
        sendHostInput();
        const now = Date.now();
        const fullSync =
          now - lastResync >= GAME_CONFIG.NETWORK.RESYNC_INTERVAL_MS;
        if (fullSync || now - lastCorrection >= CORRECTION_INTERVAL_MS) {
          sendCorrections();
          lastCorrection = now;
          if (fullSync) {
            lastResync = now;
          }
        }
      }
    }

    // Guest: detect host gone silent
    if (
      gameMode === "online-guest" &&
      !isDisconnected &&
      !isReconnecting &&
      lastDataReceived > 0 &&
      Date.now() - lastDataReceived > DATA_TIMEOUT_MS
    ) {
      console.warn("[Game] No data from host for " + DATA_TIMEOUT_MS + "ms — triggering reconnect");
      lastDataReceived = 0; // prevent repeated triggers
      handleDisconnect();
    }

    // --- Render with sub-tick interpolation ---
    // alpha ∈ [0,1): 0 = right after physics tick, →1 = just before next tick.
    // Standard fixed-timestep interpolation: renders one tick behind for
    // perfectly smooth motion at any display refresh rate.
    const renderAlpha = physicsAccumulator / PHYSICS_STEP_MS;
    interpolateForRender(renderAlpha);

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
    Renderer.drawMazeAnnouncement(rawDt);

    // Restore physics positions after rendering so game state stays accurate
    restorePhysicsPositions();

    // Overlays (drawn AFTER restore — they don't use entity positions)
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
    if (isReconnecting) {
      const secsLeft = Math.max(
        0,
        Math.ceil((reconnectDeadline - Date.now()) / 1000),
      );
      Renderer.drawReconnecting(secsLeft);
    } else if (isDisconnected) {
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

    // Tap-to-restart on canvas (mobile — no "R" key)
    canvas.addEventListener("click", () => {
      if (
        gameState === STATE.GAME_OVER &&
        (gameMode === "online-host" || gameMode === "local")
      ) {
        restartGame();
      }
    });

    // Mobile touch controls
    initTouchControls();

    // Reconnect when tab comes back to foreground
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;

    const controls = document.getElementById("controls-help");
    const controlsVisible =
      controls && controls.style.display !== "none" && controls.offsetHeight;
    const controlsHeight = controlsVisible ? controls.offsetHeight : 0;

    const touchControls = document.getElementById("touch-controls");
    const touchControlsHeight =
      touchControls && touchControls.offsetParent !== null
        ? touchControls.offsetHeight
        : 0;

    const availableWidth = Math.max(
      1,
      window.innerWidth - GAME_CONFIG.VIEWPORT.SAFE_MARGIN * 2,
    );
    const availableHeight = Math.max(
      1,
      window.innerHeight -
        controlsHeight -
        touchControlsHeight -
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

  // ---- Mobile touch controls ----
  function initTouchControls() {
    const shootBtn = document.getElementById("shoot-btn");
    const joystickZone = document.getElementById("joystick-zone");
    const joystickBase = document.getElementById("joystick-base");
    const joystickKnob = document.getElementById("joystick-knob");

    if (!shootBtn || !joystickZone || !joystickBase || !joystickKnob) return;

    const DEAD_ZONE = 14; // px — minimum drag before a direction registers
    const BASE_RADIUS = 65; // half of joystick-base width (130px)
    const KNOB_LIMIT = BASE_RADIUS - 28; // max knob travel from center

    // ---- Shoot button ----
    shootBtn.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        keys["Space"] = true;
      },
      { passive: false },
    );

    shootBtn.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        keys["Space"] = false;
      },
      { passive: false },
    );

    shootBtn.addEventListener("touchcancel", () => {
      keys["Space"] = false;
    });

    // ---- Joystick ----
    let joystickTouchId = null;
    let baseCX = 0;
    let baseCY = 0;

    function getBaseCenter() {
      const rect = joystickBase.getBoundingClientRect();
      return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
    }

    function clearDirectionKeys() {
      keys["KeyW"] = false;
      keys["KeyS"] = false;
      keys["KeyA"] = false;
      keys["KeyD"] = false;
    }

    function applyJoystickVector(dx, dy) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      clearDirectionKeys();
      if (dist < DEAD_ZONE) {
        joystickKnob.style.transform = "translate(0px, 0px)";
        return;
      }
      // Clamp knob visual position
      const clampedDist = Math.min(dist, KNOB_LIMIT);
      const nx = (dx / dist) * clampedDist;
      const ny = (dy / dist) * clampedDist;
      joystickKnob.style.transform = `translate(${nx}px, ${ny}px)`;

      // 8-directional mapping using 45° sectors
      // atan2: right=0, down=PI/2, left=±PI, up=-PI/2
      const a = Math.atan2(dy, dx);
      const PI8 = Math.PI / 8;

      if (a > -5 * PI8 && a <= -3 * PI8) {
        keys["KeyW"] = true;
      } // N
      if (a > -3 * PI8 && a <= -PI8) {
        keys["KeyW"] = true;
        keys["KeyD"] = true;
      } // NE
      if (a > -PI8 && a <= PI8) {
        keys["KeyD"] = true;
      } // E
      if (a > PI8 && a <= 3 * PI8) {
        keys["KeyD"] = true;
        keys["KeyS"] = true;
      } // SE
      if (a > 3 * PI8 && a <= 5 * PI8) {
        keys["KeyS"] = true;
      } // S
      if (a > 5 * PI8 && a <= 7 * PI8) {
        keys["KeyS"] = true;
        keys["KeyA"] = true;
      } // SW
      if (a > 7 * PI8 || a <= -7 * PI8) {
        keys["KeyA"] = true;
      } // W
      if (a > -7 * PI8 && a <= -5 * PI8) {
        keys["KeyA"] = true;
        keys["KeyW"] = true;
      } // NW
    }

    joystickZone.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        if (joystickTouchId !== null) return; // already tracking
        const touch = e.changedTouches[0];
        joystickTouchId = touch.identifier;
        const c = getBaseCenter();
        baseCX = c.cx;
        baseCY = c.cy;
        applyJoystickVector(touch.clientX - baseCX, touch.clientY - baseCY);
      },
      { passive: false },
    );

    joystickZone.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === joystickTouchId) {
            applyJoystickVector(touch.clientX - baseCX, touch.clientY - baseCY);
            break;
          }
        }
      },
      { passive: false },
    );

    function onJoystickEnd(e) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId) {
          joystickTouchId = null;
          clearDirectionKeys();
          joystickKnob.style.transform = "translate(0px, 0px)";
          break;
        }
      }
    }

    joystickZone.addEventListener("touchend", onJoystickEnd, {
      passive: false,
    });
    joystickZone.addEventListener("touchcancel", onJoystickEnd, {
      passive: false,
    });
  }

  // ---- Select maze from lobby ----
  function selectMaze(mazeKey) {
    if (MAZES[mazeKey]) {
      selectedMazeKey = mazeKey;
      activeMaze = parseMaze(mazeKey);
      Renderer.invalidateMazeCache();
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

    // Check for saved game state to resume (host page reload mid-match)
    const resume = isHost && pendingResumeState ? pendingResumeState : null;
    if (resume) pendingResumeState = null;

    // Only host shuffles maze order; guest receives it via config message
    if (isHost) {
      mazeOrder = resume && resume.mazeOrder ? resume.mazeOrder : shuffleMazeOrder();
    }
    mazesPlayed = resume ? (resume.mazesPlayed ?? 0) : 0;
    selectedMazeKey = resume && resume.selectedMazeKey ? resume.selectedMazeKey : mazeOrder[0];
    activeMaze = parseMaze(selectedMazeKey);
    Renderer.invalidateMazeCache();
    mazeRotationStart = resume && resume.mazeRotationStart ? resume.mazeRotationStart : Date.now();
    matchStartTime = resume && resume.matchStartTime ? resume.matchStartTime : Date.now();

    // Persist session so a page reload can rejoin the same room
    const code = Network.getLastRoomCode();
    if (code) saveSession(isHost ? "host" : "guest", code);

    // Hide UI, show game
    document.getElementById("lobby").style.display = "none";
    document.getElementById("connectionUI").style.display = "none";
    document.getElementById("gameContainer").style.display = "flex";
    document.getElementById("controls-help").style.display = "block";
    updateControlsHelp();
    resizeCanvas();

    // Create players
    p1 = createPlayer(1);
    p2 = createPlayer(2);
    if (resume) {
      p1.score = resume.p1Score ?? 0;
      p2.score = resume.p2Score ?? 0;
    }
    bullets = [];
    bombs = [];
    explosions = [];
    lastBombSpawn = Date.now();
    zombies = [];
    lastZombieSpawn = Date.now();
    hostP1State = null;
    hostP2State = null;

    init();
    if (resume) {
      // Resume mid-match: jump to PLAYING, skip the 3-2-1 countdown
      gameState = STATE.PLAYING;
    } else {
      startCountdown();
    }
    lastResync = Date.now();
    lastDataReceived = Date.now();
    lastTime = performance.now();
    physicsAccumulator = 0;
    requestAnimationFrame(gameLoop);
  }

  // ---- Rejoin a saved session after page reload ----
  function rejoinSession() {
    const s = getSavedSession();
    if (!s) return false;
    console.log("[Game] Resuming saved session:", s.role, s.roomCode);
    if (s.role === "host") {
      // Manually show host UI with saved room code — do NOT call showOnlineUI
      // because it now auto-generates a new code and immediately starts PeerJS.
      document.getElementById("lobby").style.display = "none";
      document.getElementById("connectionUI").style.display = "block";
      document.getElementById("hostUI").style.display = "block";
      document.getElementById("joinUI").style.display = "none";
      Network.setLastRoomCode(s.roomCode);
      document.getElementById("roomCode").textContent = s.roomCode;
      const shareLink = document.getElementById("shareLink");
      const url = buildShareLink(s.roomCode);
      if (shareLink) {
        shareLink.href = url;
        shareLink.textContent = url;
      }
      document.getElementById("connectionStatus").style.display = "";
      document.getElementById("connectionStatus").textContent = "Rejoining room...";
      document.getElementById("connectionStatus").className = "";
      // Stash full game state so startOnlineGame can resume mid-match
      pendingResumeState = s;
      lobbyRetryCount = 0;
      setupHostRoom(s.roomCode, true);
    } else {
      // Guest: auto-join the room
      showOnlineUI("join");
      const input = document.getElementById("roomCodeInput");
      if (input) input.value = s.roomCode;
      document.getElementById("joinStatus").textContent = "Reconnecting...";
      document.getElementById("joinStatus").className = "";
      Network.joinGame(s.roomCode, {
        onConnected: () => {
          document.getElementById("joinStatus").textContent =
            "Connected! Waiting for host to start...";
          document.getElementById("joinStatus").className = "status-connected";
          Network.send({ type: "ready" });
        },
        onData: handleNetworkData,
        onDisconnected: handleDisconnect,
        onError: (msg) => {
          document.getElementById("joinStatus").textContent = msg;
          document.getElementById("joinStatus").className = "status-error";
          // Clear session on hard failure so we don't loop
          clearSession();
        },
      });
    }
    return true;
  }

  return {
    startOnlineGame,
    restartGame,
    selectMaze,
    showOnlineUI,
    joinOnlineGame,
    cancelOnline,
    copyShareLink,
    returnToLobby,
    rejoinSession,
    getState: () => ({ p1, p2, bullets, gameState, winner, gameMode }),
  };
})();
