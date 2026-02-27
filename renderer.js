// ===========================================
// Renderer — Canvas Drawing
// ===========================================

const Renderer = (() => {
  const RENDER_CONFIG = {
    HUD: {
      HEIGHT: 55,
      PADDING_Y: 6,
      HEALTH_WIDTH: 100,
      HEALTH_HEIGHT: 8,
    },
    FONTS: {
      HUD: "bold 16px Courier New",
      HUD_SMALL: "10px Courier New",
      LABEL: "bold 12px Courier New",
      COUNTDOWN: "bold 120px Courier New",
      RESPAWN: "bold 20px Courier New",
      GAME_OVER: "bold 60px Courier New",
      GAME_OVER_SUB: "16px Courier New",
      DISCONNECT: "bold 36px Courier New",
      DISCONNECT_SUB: "16px Courier New",
      ANNOUNCE: "bold 36px Courier New",
      ANNOUNCE_SUB: "14px Courier New",
    },
    EFFECTS: {
      CORNER_ACCENT_LEN: 16,
      SCANLINE_STEP: 3,
      SCANLINE_ALPHA: 0.04,
      MAZE_ANNOUNCE_MS: 2500,
    },
    INDICATOR: {
      OFFSET: 16,
      RADIUS: 4,
    },
  };

  let ctx = null;
  let mazeCache = null;

  function init(canvasCtx) {
    ctx = canvasCtx;
  }

  function invalidateMazeCache() {
    mazeCache = null;
  }

  // ---- Background & Arena ----
  function drawArena() {
    // Dark background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // ---- Draw Grid Maze (retro style matching maze.jsx) ----
  // Render maze to a given 2D context (used for both live and cache)
  function drawMazeToContext(target) {
    const grid = activeMaze.grid;

    // Pass 1: Draw all cell backgrounds + grid lines on every cell
    for (let r = 0; r < MAZE_ROWS; r++) {
      for (let c = 0; c < MAZE_COLS; c++) {
        const cell = grid[r][c];
        const x = c * CELL_W;
        const y = r * CELL_H;

        if (cell === CELL_WALL) {
          // Wall tile — retro depth effect
          target.fillStyle = "#2d2d4a";
          target.fillRect(x, y, CELL_W, CELL_H);

          // Outer border (bright edge)
          target.strokeStyle = "#4a4a6a";
          target.lineWidth = 1;
          target.strokeRect(x + 0.5, y + 0.5, CELL_W - 1, CELL_H - 1);

          // Inner border detail (subtle inner rectangle for depth)
          target.strokeStyle = "rgba(100, 100, 180, 0.2)";
          target.lineWidth = 1;
          target.strokeRect(x + 3, y + 3, CELL_W - 6, CELL_H - 6);

          // Inset shadow simulation — darker edges on bottom-right
          target.fillStyle = "rgba(0, 0, 0, 0.15)";
          target.fillRect(x + CELL_W - 3, y + 1, 3, CELL_H - 1); // right shadow
          target.fillRect(x + 1, y + CELL_H - 3, CELL_W - 1, 3); // bottom shadow

          // Inset highlight — lighter edge on top-left
          target.fillStyle = "rgba(100, 100, 160, 0.15)";
          target.fillRect(x + 1, y + 1, 3, CELL_H - 2); // left highlight
          target.fillRect(x + 1, y + 1, CELL_W - 2, 3); // top highlight
        } else if (cell === CELL_P1 || cell === CELL_P2) {
          // Spawn zones — render as plain path (no visual indicator)
          target.fillStyle = COLORS.background;
          target.fillRect(x, y, CELL_W, CELL_H);
        } else if (cell === CELL_ZOMBIE) {
          // Zombie cells render as plain path (dynamic zombies drawn separately)
          target.fillStyle = COLORS.background;
          target.fillRect(x, y, CELL_W, CELL_H);
        } else if (cell === CELL_BOMB) {
          // Bomb cells now render as plain path (dynamic bombs drawn separately)
          target.fillStyle = COLORS.background;
          target.fillRect(x, y, CELL_W, CELL_H);
        } else {
          // Path cell — dark background (already drawn by drawArena)
          // Still draw cell-specific bg so grid lines show properly
          target.fillStyle = COLORS.background;
          target.fillRect(x, y, CELL_W, CELL_H);
        }

        // Grid lines on EVERY cell (the subtle grid overlay)
        target.strokeStyle = "#1a1a2e";
        target.lineWidth = 1;
        target.strokeRect(x + 0.5, y + 0.5, CELL_W - 1, CELL_H - 1);
      }
    }

    // Arena border — dark outer border
    target.strokeStyle = "#2a2a4a";
    target.lineWidth = 3;
    target.strokeRect(1.5, 1.5, CANVAS_WIDTH - 3, CANVAS_HEIGHT - 3);

    // Orange glow corner accents (matching maze.jsx)
    drawCornerAccentTo(target, 0, 0, 1, 1); // top-left
    drawCornerAccentTo(target, CANVAS_WIDTH, 0, -1, 1); // top-right
    drawCornerAccentTo(target, 0, CANVAS_HEIGHT, 1, -1); // bottom-left
    drawCornerAccentTo(target, CANVAS_WIDTH, CANVAS_HEIGHT, -1, -1); // bottom-right

    // CRT scanline overlay (subtle horizontal lines)
    drawScanlinesTo(target);
  }

  function drawMaze() {
    if (!mazeCache) {
      mazeCache = document.createElement("canvas");
      mazeCache.width = CANVAS_WIDTH;
      mazeCache.height = CANVAS_HEIGHT;
      drawMazeToContext(mazeCache.getContext("2d"));
    }
    ctx.drawImage(mazeCache, 0, 0);
  }

  // ---- Orange Glow Corner Accents ----
  function drawCornerAccentTo(target, cx, cy, dirX, dirY) {
    const len = RENDER_CONFIG.EFFECTS.CORNER_ACCENT_LEN;
    target.strokeStyle = "#ff6b00";
    target.lineWidth = 2;
    target.globalAlpha = 0.5;
    target.beginPath();
    target.moveTo(cx, cy + dirY * len);
    target.lineTo(cx, cy);
    target.lineTo(cx + dirX * len, cy);
    target.stroke();
    target.globalAlpha = 1;
  }

  // ---- CRT Scanline Pattern (pre-rendered, reused via pattern fill) ----
  const scanlinePattern = (() => {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = RENDER_CONFIG.EFFECTS.SCANLINE_STEP;
    const sctx = c.getContext("2d");
    sctx.fillStyle = `rgba(0, 0, 0, ${RENDER_CONFIG.EFFECTS.SCANLINE_ALPHA})`;
    sctx.fillRect(0, 0, 1, 1);
    return sctx.createPattern(c, "repeat");
  })();

  function drawScanlinesTo(target) {
    target.fillStyle = scanlinePattern;
    target.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // ---- Player ----
  function drawPlayer(player, label) {
    if (!player.alive) return; // don't draw dead players

    const color = player.id === 1 ? COLORS.p1 : COLORS.p2;
    const darkColor = player.id === 1 ? COLORS.p1Dark : COLORS.p2Dark;

    const cx = player.x + PLAYER_SIZE / 2;
    const cy = player.y + PLAYER_SIZE / 2;
    const half = PLAYER_SIZE / 2;

    // Calculate rotation angle from facing direction (default points right)
    let angle = 0;
    if (player.dir.dx === 1 && player.dir.dy === 0)
      angle = 0; // Right
    else if (player.dir.dx === -1 && player.dir.dy === 0)
      angle = Math.PI; // Left
    else if (player.dir.dy === -1 && player.dir.dx === 0)
      angle = -Math.PI / 2; // Up
    else if (player.dir.dy === 1 && player.dir.dx === 0) angle = Math.PI / 2; // Down

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Player glow effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    // Player body — triangle pointing right (tip at front, flat base at back)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(half + 2, 0); // Tip (front)
    ctx.lineTo(-half, -half); // Top-left (back)
    ctx.lineTo(-half, half); // Bottom-left (back)
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;

    // Triangle border
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // Player label above (neon glow)
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    ctx.font = RENDER_CONFIG.FONTS.LABEL;
    ctx.textAlign = "center";
    ctx.fillText(label, cx, player.y - 18);
    ctx.shadowBlur = 0;

    // Health bar above player
    drawHealthBar(
      player.x,
      player.y - 12,
      PLAYER_SIZE,
      6,
      player.health,
      PLAYER_HEALTH,
    );
  }

  // Direction indicator removed — triangle body itself shows facing direction

  // ---- Health Bar ----
  function drawHealthBar(x, y, width, height, current, max) {
    const ratio = Math.max(0, current / max);

    // Background
    ctx.fillStyle = COLORS.healthBg;
    ctx.fillRect(x, y, width, height);

    // Fill
    ctx.fillStyle = ratio > 0.3 ? COLORS.healthGreen : COLORS.healthRed;
    ctx.fillRect(x, y, width * ratio, height);

    // Border
    ctx.strokeStyle = COLORS.healthBg;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
  }

  // ---- Bullets ----
  function drawBullets(bullets) {
    bullets.forEach((b) => {
      const isP1 = b.owner === 1;
      const fillColor = isP1 ? COLORS.bulletP1 : COLORS.bulletP2;
      const glowColor = isP1 ? COLORS.bulletP1Glow : COLORS.bulletP2Glow;

      // Compute rotation from velocity
      const angle = Math.atan2(b.dy, b.dx);

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(angle);

      // Outer glow layer
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 14;
      ctx.fillStyle = glowColor;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(
        -BULLET_WIDTH / 2 - 1,
        -BULLET_HEIGHT / 2 - 1,
        BULLET_WIDTH + 2,
        BULLET_HEIGHT + 2,
      );
      ctx.globalAlpha = 1;

      // Core bullet rectangle
      ctx.shadowBlur = 8;
      ctx.fillStyle = fillColor;
      ctx.fillRect(
        -BULLET_WIDTH / 2,
        -BULLET_HEIGHT / 2,
        BULLET_WIDTH,
        BULLET_HEIGHT,
      );

      // Hot-white center streak
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(-BULLET_WIDTH / 2 + 2, -1, BULLET_WIDTH - 4, 2);

      ctx.restore();
    });
  }

  // ---- HUD (Top Bar) ----
  function drawHUD(p1, p2, mazeTimeLeft, matchTimeLeft, mazesPlayed) {
    // Semi-transparent HUD background
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, RENDER_CONFIG.HUD.HEIGHT);

    const hudY = RENDER_CONFIG.HUD.PADDING_Y;

    // P1 info — left side (neon glow)
    ctx.shadowColor = COLORS.p1;
    ctx.shadowBlur = 4;
    ctx.fillStyle = COLORS.p1;
    ctx.font = RENDER_CONFIG.FONTS.HUD;
    ctx.textAlign = "left";
    ctx.fillText(`P1: ${p1.score} kills`, 20, hudY + 16);
    ctx.shadowBlur = 0;
    drawHealthBar(
      20,
      hudY + 24,
      RENDER_CONFIG.HUD.HEALTH_WIDTH,
      RENDER_CONFIG.HUD.HEALTH_HEIGHT,
      p1.health,
      PLAYER_HEALTH,
    );

    // P2 info — right side (neon glow)
    ctx.shadowColor = COLORS.p2;
    ctx.shadowBlur = 4;
    ctx.fillStyle = COLORS.p2;
    ctx.textAlign = "right";
    ctx.fillText(`P2: ${p2.score} kills`, CANVAS_WIDTH - 20, hudY + 16);
    ctx.shadowBlur = 0;
    drawHealthBar(
      CANVAS_WIDTH - 20 - RENDER_CONFIG.HUD.HEALTH_WIDTH,
      hudY + 24,
      RENDER_CONFIG.HUD.HEALTH_WIDTH,
      RENDER_CONFIG.HUD.HEALTH_HEIGHT,
      p2.health,
      PLAYER_HEALTH,
    );

    // Center — maze name + map counter + match timer
    ctx.shadowColor = "#ff6b00";
    ctx.shadowBlur = 4;
    ctx.fillStyle = "#ff6b00";
    ctx.textAlign = "center";
    ctx.font = RENDER_CONFIG.FONTS.LABEL;
    const mapLabel = `${activeMaze.name}  (${mazesPlayed + 1}/${MAZE_KEYS.length})`;
    ctx.fillText(mapLabel, CANVAS_WIDTH / 2, hudY + 10);
    ctx.shadowBlur = 0;

    ctx.font = RENDER_CONFIG.FONTS.HUD_SMALL;
    // Current maze timer
    if (mazeTimeLeft != null) {
      const mzMins = Math.floor(mazeTimeLeft / 60);
      const mzSecs = Math.floor(mazeTimeLeft % 60);
      ctx.fillStyle = "#aaa";
      ctx.fillText(
        `Next map: ${mzMins}:${mzSecs.toString().padStart(2, "0")}`,
        CANVAS_WIDTH / 2,
        hudY + 24,
      );
    }
    // Overall match timer
    if (matchTimeLeft != null) {
      const mtMins = Math.floor(matchTimeLeft / 60);
      const mtSecs = Math.floor(matchTimeLeft % 60);
      const urgent = matchTimeLeft <= 30;
      ctx.fillStyle = urgent ? "#ff4444" : "#666";
      ctx.fillText(
        `Match: ${mtMins}:${mtSecs.toString().padStart(2, "0")}`,
        CANVAS_WIDTH / 2,
        hudY + 36,
      );
    }
  }

  // ---- Countdown Overlay ----
  function drawCountdown(seconds) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const text = seconds > 0 ? seconds.toString() : "GO!";
    const glowColor = seconds > 0 ? "#ff6b00" : "#44ff44";

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 30;
    ctx.fillStyle = glowColor;
    ctx.font = RENDER_CONFIG.FONTS.COUNTDOWN;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.shadowBlur = 0;

    ctx.textBaseline = "alphabetic";
  }

  // ---- Respawn Timer ----
  function drawRespawnTimer(player, timeLeft) {
    const cx = player.x + PLAYER_SIZE / 2;
    const cy = player.y + PLAYER_SIZE / 2;
    const color = player.id === 1 ? COLORS.p1 : COLORS.p2;

    // Pulsing ghost outline with glow
    const pulse = 0.2 + 0.15 * Math.sin(Date.now() / 200);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = pulse;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.strokeRect(player.x, player.y, PLAYER_SIZE, PLAYER_SIZE);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Countdown text with glow
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#ffffff";
    ctx.font = RENDER_CONFIG.FONTS.RESPAWN;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Math.ceil(timeLeft / 1000).toString(), cx, cy);
    ctx.shadowBlur = 0;
    ctx.textBaseline = "alphabetic";
  }

  // ---- Game Over Screen ----
  function drawGameOver(winner, isGuest, p1, p2, isDraw) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    if (isDraw) {
      // Draw scenario
      ctx.shadowColor = "#ff6b00";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#ff6b00";
      ctx.font = RENDER_CONFIG.FONTS.GAME_OVER;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("IT'S A DRAW!", centerX, centerY - 60);
      ctx.shadowBlur = 0;
    } else {
      const winColor = winner === 1 ? COLORS.p1 : COLORS.p2;

      // Winner text with neon glow
      ctx.shadowColor = winColor;
      ctx.shadowBlur = 20;
      ctx.fillStyle = winColor;
      ctx.font = RENDER_CONFIG.FONTS.GAME_OVER;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`PLAYER ${winner} WINS!`, centerX, centerY - 60);
      ctx.shadowBlur = 0;
    }

    // Final scores
    if (p1 && p2) {
      ctx.font = RENDER_CONFIG.FONTS.HUD;
      ctx.textAlign = "center";

      ctx.fillStyle = COLORS.p1;
      ctx.shadowColor = COLORS.p1;
      ctx.shadowBlur = 6;
      ctx.fillText(`P1: ${p1.score} kills`, centerX - 80, centerY);
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#666";
      ctx.fillText("vs", centerX, centerY);

      ctx.fillStyle = COLORS.p2;
      ctx.shadowColor = COLORS.p2;
      ctx.shadowBlur = 6;
      ctx.fillText(`P2: ${p2.score} kills`, centerX + 80, centerY);
      ctx.shadowBlur = 0;

      // "TIME'S UP" label
      ctx.fillStyle = "#888";
      ctx.font = RENDER_CONFIG.FONTS.LABEL;
      ctx.fillText("TIME'S UP", centerX, centerY + 30);
    }

    ctx.fillStyle = "#666666";
    ctx.font = RENDER_CONFIG.FONTS.GAME_OVER_SUB;
    ctx.fillText(
      isGuest ? "Waiting for host to restart..." : "Press R to restart",
      centerX,
      centerY + 65,
    );

    ctx.textBaseline = "alphabetic";
  }

  // ---- Online Connection Indicator ----
  function drawOnlineIndicator(connected) {
    const x = CANVAS_WIDTH - RENDER_CONFIG.INDICATOR.OFFSET;
    const y = CANVAS_HEIGHT - RENDER_CONFIG.INDICATOR.OFFSET;
    const color = connected ? "#2ecc71" : "#e74c3c";

    // Glowing dot
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(x, y, RENDER_CONFIG.INDICATOR.RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = "#888";
    ctx.font = RENDER_CONFIG.FONTS.HUD_SMALL;
    ctx.textAlign = "right";
    ctx.fillText("P2P", x - 10, y + 4);
  }

  // ---- Disconnect Overlay ----
  function drawDisconnected() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.shadowColor = "#ff4444";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#ff4444";
    ctx.font = RENDER_CONFIG.FONTS.DISCONNECT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "OPPONENT DISCONNECTED",
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 - 20,
    );
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#888";
    ctx.font = RENDER_CONFIG.FONTS.DISCONNECT_SUB;
    ctx.fillText(
      "Returning to lobby...",
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 25,
    );
    ctx.textBaseline = "alphabetic";
  }

  function drawReconnecting(secondsLeft) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.shadowColor = "#ffaa00";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#ffaa00";
    ctx.font = RENDER_CONFIG.FONTS.DISCONNECT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CONNECTION LOST", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#aaa";
    ctx.font = RENDER_CONFIG.FONTS.DISCONNECT_SUB;
    ctx.fillText(
      `Reconnecting\u2026 (${secondsLeft}s)`,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 25,
    );
    ctx.textBaseline = "alphabetic";
  }

  // ---- Maze Change Announcement ----
  let mazeAnnouncement = null;
  let mazeAnnouncementTimer = 0;

  function showMazeAnnouncement(mazeName) {
    mazeAnnouncement = mazeName;
    mazeAnnouncementTimer = RENDER_CONFIG.EFFECTS.MAZE_ANNOUNCE_MS;
  }

  function drawMazeAnnouncement(dt) {
    if (!mazeAnnouncement || mazeAnnouncementTimer <= 0) return;
    mazeAnnouncementTimer -= dt;

    const alpha = Math.min(1, mazeAnnouncementTimer / 500); // fade out last 500ms
    ctx.fillStyle = `rgba(0, 0, 0, ${0.75 * alpha})`;
    ctx.fillRect(0, CANVAS_HEIGHT / 2 - 60, CANVAS_WIDTH, 120);

    ctx.globalAlpha = alpha;

    // Map name with neon glow
    ctx.shadowColor = "#ff6b00";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#ff6b00";
    ctx.font = RENDER_CONFIG.FONTS.ANNOUNCE;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(mazeAnnouncement, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#888";
    ctx.font = RENDER_CONFIG.FONTS.ANNOUNCE_SUB;
    ctx.fillText("MAP CHANGED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 25);
    ctx.globalAlpha = 1;
    ctx.textBaseline = "alphabetic";

    if (mazeAnnouncementTimer <= 0) mazeAnnouncement = null;
  }

  // ---- Dynamic Bombs (heartbeat animation) ----
  function drawBombs(bombs) {
    const now = Date.now();
    bombs.forEach((bomb) => {
      const cx = bomb.x;
      const cy = bomb.y;
      const fuseRatio = Math.max(0, bomb.fuseLeft / BOMB_FUSE_TIME); // 1→0

      // Heartbeat pulse: gets faster as fuse runs down
      const pulseSpeed = 100 + 500 * fuseRatio; // fast near end, slow at start
      const pulse = 1 + 0.15 * Math.sin((now / pulseSpeed) * Math.PI * 2);

      // Ground glow circle (danger zone indicator)
      const dangerAlpha = 0.08 + 0.12 * (1 - fuseRatio);
      const grd = ctx.createRadialGradient(
        cx,
        cy,
        0,
        cx,
        cy,
        BOMB_BLAST_RADIUS,
      );
      grd.addColorStop(0, `rgba(255, 100, 0, ${dangerAlpha})`);
      grd.addColorStop(1, "rgba(255, 100, 0, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, BOMB_BLAST_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Bomb body — pulsing circle
      const bombSize = CELL_W * 0.35 * pulse;
      ctx.save();

      // Glow color shifts from orange to red as fuse runs down
      const r = Math.floor(255);
      const g = Math.floor(170 * fuseRatio);
      const b = 0;
      const glowColor = `rgb(${r}, ${g}, ${b})`;

      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 12 * pulse;

      // Bomb body
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.arc(cx, cy, bombSize, 0, Math.PI * 2);
      ctx.fill();

      // Bomb highlight
      ctx.fillStyle = glowColor;
      ctx.globalAlpha = 0.5 + 0.3 * (1 - fuseRatio);
      ctx.beginPath();
      ctx.arc(cx, cy, bombSize * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Fuse spark on top
      const sparkAngle = (now / 100) % (Math.PI * 2);
      const sparkX = cx + Math.cos(sparkAngle) * bombSize * 0.3;
      const sparkY = cy - bombSize * 0.8;
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#ffff00";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 2 + Math.random() * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Bomb emoji on top of body
      ctx.font = `${Math.floor(bombSize * 1.4)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("💣", cx, cy);

      ctx.restore();

      // Timer text below bomb
      const secsLeft = Math.ceil(bomb.fuseLeft / 1000);
      ctx.fillStyle = fuseRatio < 0.33 ? "#ff3333" : "#ffaa00";
      ctx.font = "bold 14px Courier New";
      ctx.textAlign = "center";
      ctx.fillText(secsLeft + "s", cx, cy + bombSize + 14);
    });
  }

  // ---- Explosion Effect ----
  function drawExplosions(explosions) {
    const now = Date.now();
    explosions.forEach((exp) => {
      const elapsed = now - exp.startTime;
      const progress = Math.min(1, elapsed / BOMB_BLAST_ANIM_MS); // 0→1
      const alpha = 1 - progress;
      const radius = BOMB_BLAST_RADIUS * (0.3 + 0.7 * progress);

      ctx.save();

      // Expanding shockwave ring
      ctx.strokeStyle = `rgba(255, 150, 0, ${alpha * 0.8})`;
      ctx.lineWidth = 4 * (1 - progress);
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner fireball glow
      const fireball = ctx.createRadialGradient(
        exp.x,
        exp.y,
        0,
        exp.x,
        exp.y,
        radius * 0.8,
      );
      fireball.addColorStop(0, `rgba(255, 255, 200, ${alpha * 0.6})`);
      fireball.addColorStop(0.3, `rgba(255, 120, 0, ${alpha * 0.4})`);
      fireball.addColorStop(1, `rgba(255, 50, 0, 0)`);
      ctx.fillStyle = fireball;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, radius * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Scattered sparks
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + progress * 2;
        const dist = radius * (0.4 + 0.6 * progress);
        const sx = exp.x + Math.cos(angle) * dist;
        const sy = exp.y + Math.sin(angle) * dist;
        ctx.fillStyle = `rgba(255, 255, 100, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 3 * (1 - progress), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  }

  // ---- Dynamic Zombies ----
  function drawZombies(zombies) {
    const now = Date.now();
    zombies.forEach((z) => {
      // Idle bobbing animation
      const bob = Math.sin(now / 300 + z.x) * 3;

      // Green ground glow
      const grd = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, CELL_W * 0.6);
      grd.addColorStop(0, "rgba(68, 255, 68, 0.12)");
      grd.addColorStop(1, "rgba(68, 255, 68, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(z.x, z.y, CELL_W * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Zombie emoji with glow + bob
      ctx.save();
      ctx.shadowColor = "#44ff44";
      ctx.shadowBlur = 10;
      ctx.font = `${Math.floor(CELL_H * 0.65)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("\uD83E\uDDDF", z.x, z.y + bob);
      ctx.shadowBlur = 0;
      ctx.restore();
    });
  }

  // ---- Freeze / Shake Effect on Player ----
  function drawFreezeEffect(player) {
    if (!player.alive) return;
    const cx = player.x + PLAYER_SIZE / 2;
    const cy = player.y + PLAYER_SIZE / 2;

    // Shake offset
    const shakeX = (Math.random() - 0.5) * 6;
    const shakeY = (Math.random() - 0.5) * 6;

    // Icy blue overlay around player
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#88ddff";
    ctx.beginPath();
    ctx.arc(cx + shakeX, cy + shakeY, PLAYER_SIZE * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Ice crystal border
    ctx.strokeStyle = "#aaeeff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#00ccff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx + shakeX, cy + shakeY, PLAYER_SIZE * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // "FROZEN" text
    ctx.fillStyle = "#00ccff";
    ctx.font = "bold 10px Courier New";
    ctx.textAlign = "center";
    ctx.fillText("FROZEN", cx + shakeX, player.y - 20 + shakeY);
    ctx.restore();
  }

  return {
    init,
    invalidateMazeCache,
    drawArena,
    drawMaze,
    drawPlayer,
    drawBullets,
    drawBombs,
    drawExplosions,
    drawZombies,
    drawFreezeEffect,
    drawHUD,
    drawCountdown,
    drawRespawnTimer,
    drawGameOver,
    drawOnlineIndicator,
    drawDisconnected,
    drawReconnecting,
    showMazeAnnouncement,
    drawMazeAnnouncement,
  };
})();
