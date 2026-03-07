// ===========================================
// Renderer — Canvas Drawing
// ===========================================

const Renderer = (() => {
  // Visual layout constants — tweak these if you change fonts or layout
  const RENDER_CONFIG = {
    HUD: {
      HEIGHT: 55,
      PADDING_Y: 6,
      HEALTH_WIDTH: 100,
      HEALTH_HEIGHT: 8,
    },
    FONTS: {
      HUD:              "bold 16px Courier New",
      HUD_SMALL:        "10px Courier New",
      LABEL:            "bold 12px Courier New",
      COUNTDOWN:        "bold 120px Courier New",
      RESPAWN:          "bold 20px Courier New",
      GAME_OVER:        "bold 60px Courier New",
      GAME_OVER_SUB:    "16px Courier New",
      DISCONNECT:       "bold 36px Courier New",
      DISCONNECT_SUB:   "16px Courier New",
      ANNOUNCE:         "bold 36px Courier New",
      ANNOUNCE_SUB:     "14px Courier New",
      BOMB_TIMER:       "bold 14px Courier New",
      IN_WORLD_LABEL:   "bold 10px Courier New",
      HEALTH_PACK_LABEL:"bold 11px Courier New",
    },
    EFFECTS: {
      CORNER_ACCENT_LEN: 16,
      SCANLINE_STEP:     3,
      SCANLINE_ALPHA:    0.04,
      MAZE_ANNOUNCE_MS:  2500,
      DAMAGE_FLASH_ALPHA: 0.35,
      LOW_HEALTH_PULSE_ALPHA: 0.28,
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

  /**
   * Called by ThemeManager.apply() to patch font strings when a theme changes.
   * fontsObj keys must match RENDER_CONFIG.FONTS key names (e.g. "HUD", "LABEL").
   */
  function applyThemeFonts(fontsObj) {
    if (!fontsObj) return;
    Object.assign(RENDER_CONFIG.FONTS, fontsObj);
  }

  // ---- Background & Arena ----
  function drawArena() {
    // Dark background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // Draw the maze to a given 2D context (used for both the live canvas and the
  // off-screen cache so we only re-render when the maze actually changes)
  function drawMazeToContext(target) {
    const grid = activeMaze.grid;

    // Each cell: background fill + grid lines
    for (let r = 0; r < MAZE_ROWS; r++) {
      for (let c = 0; c < MAZE_COLS; c++) {
        const cell = grid[r][c];
        const x = c * CELL_W;
        const y = r * CELL_H;

        if (cell === CELL_WALL) {
          // Retro depth effect on wall tiles
          target.fillStyle = COLORS.wall;
          target.fillRect(x, y, CELL_W, CELL_H);

          target.strokeStyle = COLORS.wallStroke;
          target.lineWidth = 1;
          target.strokeRect(x + 0.5, y + 0.5, CELL_W - 1, CELL_H - 1);

          // Inner rectangle for a subtle inset look
          target.strokeStyle = COLORS.wallInner;
          target.lineWidth = 1;
          target.strokeRect(x + 3, y + 3, CELL_W - 6, CELL_H - 6);

          // Bottom-right shadow
          target.fillStyle = COLORS.wallShadowDark;
          target.fillRect(x + CELL_W - 3, y + 1, 3, CELL_H - 1);
          target.fillRect(x + 1, y + CELL_H - 3, CELL_W - 1, 3);

          // Top-left highlight
          target.fillStyle = COLORS.wallHighlight;
          target.fillRect(x + 1, y + 1, 3, CELL_H - 2);
          target.fillRect(x + 1, y + 1, CELL_W - 2, 3);
        } else {
          // Spawn, zombie, bomb and normal path cells all render as plain floor
          target.fillStyle = COLORS.background;
          target.fillRect(x, y, CELL_W, CELL_H);
        }

        // Subtle grid overlay on every cell
        target.strokeStyle = COLORS.gridLine;
        target.lineWidth = 1;
        target.strokeRect(x + 0.5, y + 0.5, CELL_W - 1, CELL_H - 1);
      }
    }

    // Arena border — dark outer border
    target.strokeStyle = COLORS.border;
    target.lineWidth = 3;
    target.strokeRect(1.5, 1.5, CANVAS_WIDTH - 3, CANVAS_HEIGHT - 3);

    // Orange glow corner accents (matching maze.jsx)
    drawCornerAccentTo(target, 0, 0, 1, 1); // top-left
    drawCornerAccentTo(target, CANVAS_WIDTH, 0, -1, 1); // top-right
    drawCornerAccentTo(target, 0, CANVAS_HEIGHT, 1, -1); // bottom-left
    drawCornerAccentTo(target, CANVAS_WIDTH, CANVAS_HEIGHT, -1, -1); // bottom-right

  }

  function drawMaze() {
    if (!mazeCache) {
      mazeCache = document.createElement("canvas");
      mazeCache.width = CANVAS_WIDTH;
      mazeCache.height = CANVAS_HEIGHT;
      drawMazeToContext(mazeCache.getContext("2d"));
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mazeCache, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  // ---- Orange Glow Corner Accents ----
  function drawCornerAccentTo(target, cx, cy, dirX, dirY) {
    const len = RENDER_CONFIG.EFFECTS.CORNER_ACCENT_LEN;
    target.strokeStyle = COLORS.accent;
    target.lineWidth = 2;
    target.globalAlpha = 0.5;
    target.beginPath();
    target.moveTo(cx, cy + dirY * len);
    target.lineTo(cx, cy);
    target.lineTo(cx + dirX * len, cy);
    target.stroke();
    target.globalAlpha = 1;
  }

  // The scanline pattern is created once at startup and reused as a fill pattern
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

  function drawPlayer(player, label) {
    if (!player.alive) return;

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

    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    // Triangle body: tip at front, flat base at back
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(half + 2, 0);     // tip (front)
    ctx.lineTo(-half, -half);    // back-top
    ctx.lineTo(-half,  half);    // back-bottom
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;

    // Triangle border
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // Label above player
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    ctx.font = RENDER_CONFIG.FONTS.LABEL;
    ctx.textAlign = "center";
    ctx.fillText(label, cx, player.y - 18);
    ctx.shadowBlur = 0;

    drawHealthBar(player.x, player.y - 12, PLAYER_SIZE, 6, player.health, PLAYER_HEALTH);
  }

  // Health bar — green when above 30%, red when critically low
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
      ctx.fillStyle = COLORS.bulletHotWhite;
      ctx.fillRect(-BULLET_WIDTH / 2 + 2, -1, BULLET_WIDTH - 4, 2);

      ctx.restore();
    });
  }

  // ---- HUD (Top Bar) ----
  function drawHUD(p1, p2, mazeTimeLeft, matchTimeLeft, mazesPlayed) {
    // Semi-transparent HUD background
    ctx.fillStyle = COLORS.overlayHudBg;
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
    ctx.shadowColor = COLORS.accent;
    ctx.shadowBlur = 4;
    ctx.fillStyle = COLORS.accent;
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
      ctx.fillStyle = COLORS.textLight;
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
      ctx.fillStyle = urgent ? COLORS.disconnectAlert : COLORS.textDim;
      ctx.fillText(
        `Match: ${mtMins}:${mtSecs.toString().padStart(2, "0")}`,
        CANVAS_WIDTH / 2,
        hudY + 36,
      );
    }
  }

  // ---- Countdown Overlay ----
  function drawCountdown(seconds) {
    ctx.fillStyle = COLORS.overlayCountdown;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const text = seconds > 0 ? seconds.toString() : "GO!";
    const glowColor = seconds > 0 ? COLORS.accent : COLORS.countdownGo;

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
    ctx.shadowColor = COLORS.white;
    ctx.shadowBlur = 6;
    ctx.fillStyle = COLORS.white;
    ctx.font = RENDER_CONFIG.FONTS.RESPAWN;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Math.ceil(timeLeft / 1000).toString(), cx, cy);
    ctx.shadowBlur = 0;
    ctx.textBaseline = "alphabetic";
  }

  // ---- Game Over Screen ----
  function drawGameOver(winner, isGuest, p1, p2, isDraw) {
    ctx.fillStyle = COLORS.overlayModal;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    if (isDraw) {
      // Draw scenario
      ctx.shadowColor = COLORS.accent;
      ctx.shadowBlur = 20;
      ctx.fillStyle = COLORS.accent;
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

      ctx.fillStyle = COLORS.textDim;
      ctx.fillText("vs", centerX, centerY);

      ctx.fillStyle = COLORS.p2;
      ctx.shadowColor = COLORS.p2;
      ctx.shadowBlur = 6;
      ctx.fillText(`P2: ${p2.score} kills`, centerX + 80, centerY);
      ctx.shadowBlur = 0;

      // "TIME'S UP" label
      ctx.fillStyle = COLORS.textMuted;
      ctx.font = RENDER_CONFIG.FONTS.LABEL;
      ctx.fillText("TIME'S UP", centerX, centerY + 30);
    }

    ctx.fillStyle = COLORS.textDim;
    ctx.font = RENDER_CONFIG.FONTS.GAME_OVER_SUB;
    ctx.fillText(
      isGuest ? "Spin joystick to request restart" : "Tap / press R to restart",
      centerX,
      centerY + 65,
    );

    ctx.textBaseline = "alphabetic";
  }

  // ---- Online Connection Indicator ----
  function drawOnlineIndicator(connected) {
    const x = CANVAS_WIDTH - RENDER_CONFIG.INDICATOR.OFFSET;
    const y = CANVAS_HEIGHT - RENDER_CONFIG.INDICATOR.OFFSET;
    const color = connected ? COLORS.healthGreen : COLORS.healthRed;

    // Glowing dot
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(x, y, RENDER_CONFIG.INDICATOR.RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = RENDER_CONFIG.FONTS.HUD_SMALL;
    ctx.textAlign = "right";
    ctx.fillText("P2P", x - 10, y + 4);
  }

  // ---- Disconnect Overlay ----
  function drawDisconnected() {
    ctx.fillStyle = COLORS.overlayModal;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.shadowColor = COLORS.disconnectAlert;
    ctx.shadowBlur = 20;
    ctx.fillStyle = COLORS.disconnectAlert;
    ctx.font = RENDER_CONFIG.FONTS.DISCONNECT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "OPPONENT DISCONNECTED",
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 - 20,
    );
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLORS.textMuted;
    ctx.font = RENDER_CONFIG.FONTS.DISCONNECT_SUB;
    ctx.fillText(
      "Returning to lobby...",
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 25,
    );
    ctx.textBaseline = "alphabetic";
  }

  function drawReconnecting(secondsLeft) {
    ctx.fillStyle = COLORS.overlayModal;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.shadowColor = COLORS.reconnectAlert;
    ctx.shadowBlur = 20;
    ctx.fillStyle = COLORS.reconnectAlert;
    ctx.font = RENDER_CONFIG.FONTS.DISCONNECT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CONNECTION LOST", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLORS.textLight;
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
    ctx.shadowColor = COLORS.accent;
    ctx.shadowBlur = 20;
    ctx.fillStyle = COLORS.accent;
    ctx.font = RENDER_CONFIG.FONTS.ANNOUNCE;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(mazeAnnouncement, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLORS.textMuted;
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

      // Danger zone flat circle — subtle, half blast radius
      const dangerAlpha = 0.04 + 0.06 * (1 - fuseRatio);
      ctx.globalAlpha = dangerAlpha;
      ctx.fillStyle = COLORS.explosionBase;
      ctx.beginPath();
      ctx.arc(cx, cy, BOMB_BLAST_RADIUS * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Bomb body — pulsing circle
      const bombSize = CELL_W * 0.35 * pulse;
      ctx.save();

      // Glow ring (cheap stroke instead of shadowBlur)
      const g = Math.floor(170 * fuseRatio);
      const glowColor = `rgb(255,${g},0)`;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.7 + 0.3 * (1 - fuseRatio);
      ctx.beginPath();
      ctx.arc(cx, cy, bombSize + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Bomb body
      ctx.fillStyle = COLORS.bombBody;
      ctx.beginPath();
      ctx.arc(cx, cy, bombSize, 0, Math.PI * 2);
      ctx.fill();

      // Bomb highlight
      ctx.fillStyle = glowColor;
      ctx.globalAlpha = 0.45 + 0.3 * (1 - fuseRatio);
      ctx.beginPath();
      ctx.arc(cx, cy, bombSize * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Fuse spark on top (no shadowBlur)
      const sparkAngle = (now / 100) % (Math.PI * 2);
      const sparkX = cx + Math.cos(sparkAngle) * bombSize * 0.3;
      const sparkY = cy - bombSize * 0.8;
      ctx.fillStyle = COLORS.bombSpark;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Bomb emoji on top of body
      ctx.font = `${Math.floor(bombSize * 1.4)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("💣", cx, cy);

      ctx.restore();

      // Timer text below bomb
      const secsLeft = Math.ceil(bomb.fuseLeft / 1000);
      ctx.fillStyle = fuseRatio < 0.33 ? COLORS.bombFuseLow : COLORS.bomb;
      ctx.font = RENDER_CONFIG.FONTS.BOMB_TIMER;
      ctx.textAlign = "center";
      ctx.fillText(secsLeft + "s", cx, cy + bombSize + 14);
    });
  }

  // ---- Explosion Effect ----
  function drawExplosions(explosions) {
    const now = Date.now();
    explosions.forEach((exp) => {
      const elapsed = Math.max(0, now - exp.startTime);
      const progress = Math.min(1, elapsed / BOMB_BLAST_ANIM_MS); // 0→1
      const alpha = 1 - progress;
      const radius = Math.max(0, BOMB_BLAST_RADIUS * (0.3 + 0.7 * progress));

      ctx.save();

      // Expanding shockwave ring
      ctx.strokeStyle = `rgba(${COLORS.explosionShockwaveRGB}, ${alpha * 0.8})`;
      ctx.lineWidth = 4 * (1 - progress);
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner fireball (two flat circles — no gradient)
      ctx.globalAlpha = alpha * 0.45;
      ctx.fillStyle = COLORS.explosionParticle;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = COLORS.explosionLight;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Scattered sparks
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + progress * 2;
        const dist = radius * (0.4 + 0.6 * progress);
        const sx = exp.x + Math.cos(angle) * dist;
        const sy = exp.y + Math.sin(angle) * dist;
        ctx.fillStyle = `rgba(${COLORS.explosionSparkRGB}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0, 3 * (1 - progress)), 0, Math.PI * 2);
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

      // Green ground circle (flat — no gradient)
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = COLORS.zombie;
      ctx.beginPath();
      ctx.arc(z.x, z.y, CELL_W * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Zombie emoji (no shadowBlur)
      ctx.font = `${Math.floor(CELL_H * 0.65)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("\uD83E\uDDDF", z.x, z.y + bob);
      ctx.textBaseline = "alphabetic";
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
    ctx.fillStyle = COLORS.freezeOverlay;
    ctx.beginPath();
    ctx.arc(cx + shakeX, cy + shakeY, PLAYER_SIZE * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Ice crystal border
    ctx.strokeStyle = COLORS.freezeStroke;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.freezeGlow;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx + shakeX, cy + shakeY, PLAYER_SIZE * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // "FROZEN" text
    ctx.fillStyle = COLORS.freezeGlow;
    ctx.font = RENDER_CONFIG.FONTS.IN_WORLD_LABEL;
    ctx.textAlign = "center";
    ctx.fillText("FROZEN", cx + shakeX, player.y - 20 + shakeY);
    ctx.restore();
  }

  function drawDamageFlash(localPlayer, rgb) {
    if (!localPlayer || !localPlayer.damageFlashTimer || localPlayer.damageFlashTimer <= 0) return;
    const t = localPlayer.damageFlashTimer / DAMAGE_FLASH_MS; // 1→0
    const alpha = (t * 0.55).toFixed(3);
    const edgeW = Math.floor(CANVAS_WIDTH  * 0.055);
    const edgeH = Math.floor(CANVAS_HEIGHT * 0.065);
    // Only paint the screen edges, not the whole canvas, to keep it subtle
    ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
    ctx.fillRect(0, 0,                    CANVAS_WIDTH, edgeH);
    ctx.fillRect(0, CANVAS_HEIGHT - edgeH, CANVAS_WIDTH, edgeH);
    ctx.fillRect(0, 0,                     edgeW, CANVAS_HEIGHT);
    ctx.fillRect(CANVAS_WIDTH - edgeW, 0,  edgeW, CANVAS_HEIGHT);
  }

  // Pulsing colored vignette on the screen edges when HP is critical
  function drawLowHealthVignette(p1, p2) {
    const configs = [
      { p: p1, rgb: COLORS.p1RGB },
      { p: p2, rgb: COLORS.p2RGB },
    ];
    configs.forEach(({ p, rgb }) => {
      if (!p.alive || p.health > LOW_HEALTH_THRESHOLD) return;
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 220);
      const alpha = (RENDER_CONFIG.EFFECTS.LOW_HEALTH_PULSE_ALPHA * pulse * 0.9).toFixed(3);
      const edgeW = Math.floor(CANVAS_WIDTH * 0.18);
      const edgeH = Math.floor(CANVAS_HEIGHT * 0.18);
      ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, edgeH);           // top
      ctx.fillRect(0, CANVAS_HEIGHT - edgeH, CANVAS_WIDTH, edgeH); // bottom
      ctx.fillRect(0, 0, edgeW, CANVAS_HEIGHT);          // left
      ctx.fillRect(CANVAS_WIDTH - edgeW, 0, edgeW, CANVAS_HEIGHT); // right
    });
  }

  // ---- Health Packs ----
  function drawHealthPacks(healthPacks) {
    const now = Date.now();
    healthPacks.forEach((hp) => {
      const cx = hp.x;
      const cy = hp.y;
      const size = CELL_W * 0.28;
      const pulse = 1 + 0.1 * Math.sin(now / 380);

      // Ground circle (flat — no gradient)
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = COLORS.healthGreen;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Green cross (no shadowBlur)
      ctx.fillStyle = COLORS.healthGreen;
      const thick = size * 0.38;
      const arm = size * pulse;
      ctx.fillRect(cx - arm, cy - thick, arm * 2, thick * 2); // horizontal bar
      ctx.fillRect(cx - thick, cy - arm, thick * 2, arm * 2); // vertical bar

      // "+HP" label
      ctx.fillStyle = COLORS.healthGreen;
      ctx.font = RENDER_CONFIG.FONTS.HEALTH_PACK_LABEL;
      ctx.textAlign = "center";
      ctx.fillText("+HP", cx, cy + size + 10);
    });
  }

  // ---- Floating Texts (damage numbers / kill-feed) ----
  function drawFloatingTexts(floatingTexts) {
    const now = Date.now();
    floatingTexts.forEach((ft) => {
      const elapsed = now - ft.startTime;
      if (elapsed >= FLOATING_TEXT_DURATION_MS) return;
      const progress = elapsed / FLOATING_TEXT_DURATION_MS; // 0→1
      const alpha = 1 - progress;
      const yOffset = progress * 42; // float upward 42px total

      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.font = RENDER_CONFIG.FONTS.HUD;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ft.text, ft.x, ft.y - yOffset);
      ctx.globalAlpha = 1;
      ctx.textBaseline = "alphabetic";
    });
  }

  // ---- Screen shake frame context ----
  function beginFrame(sx, sy) {
    ctx.save();
    if (sx || sy) ctx.translate(sx, sy);
  }

  function endFrame() {
    ctx.restore();
  }

  // ---- Speed Boost Pickups (yellow lightning bolt) ----
  function drawSpeedBoostPickups(pickups) {
    const now = Date.now();
    pickups.forEach((p) => {
      const cx = p.x;
      const cy = p.y;
      const size = CELL_W * 0.3;
      const pulse = 1 + 0.12 * Math.sin(now / 300);

      // Ground circle (flat — no gradient)
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = COLORS.speedBoostYellow;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Lightning bolt shape (no shadowBlur)
      ctx.save();
      ctx.fillStyle = COLORS.speedBoostYellow;
      ctx.strokeStyle = COLORS.speedBoostStroke;
      ctx.lineWidth = 1.2;
      const s = size * pulse;
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.22, cy - s);
      ctx.lineTo(cx - s * 0.12, cy - s * 0.08);
      ctx.lineTo(cx + s * 0.22, cy - s * 0.08);
      ctx.lineTo(cx - s * 0.22, cy + s);
      ctx.lineTo(cx + s * 0.12, cy + s * 0.08);
      ctx.lineTo(cx - s * 0.22, cy + s * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = COLORS.speedBoostYellow;
      ctx.font = RENDER_CONFIG.FONTS.IN_WORLD_LABEL;
      ctx.textAlign = "center";
      ctx.fillText("SPEED", cx, cy + size + 12);
    });
  }

  // ---- Weapon Pickups (blue = rapidfire, orange = scatter) ----
  function drawWeaponPickups(pickups) {
    const now = Date.now();
    pickups.forEach((p) => {
      const cx = p.x;
      const cy = p.y;
      const size = CELL_W * 0.28;
      const pulse = 1 + 0.1 * Math.sin(now / 340);
      const isRapid = p.type === 'rapidfire';
      const mainColor = isRapid ? COLORS.weaponRapidfire : COLORS.weaponScatter;

      // Ground circle (flat — no gradient)
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Gun silhouette (no shadowBlur)
      ctx.save();
      ctx.fillStyle = mainColor;
      const s = size * pulse;
      // Body
      ctx.fillRect(cx - s * 0.65, cy - s * 0.22, s * 1.1, s * 0.44);
      // Barrel
      ctx.fillRect(cx + s * 0.45, cy - s * 0.12, s * 0.5, s * 0.24);
      // Handle
      ctx.fillRect(cx - s * 0.28, cy + s * 0.22, s * 0.3, s * 0.38);
      ctx.restore();

      ctx.fillStyle = mainColor;
      ctx.font = RENDER_CONFIG.FONTS.IN_WORLD_LABEL;
      ctx.textAlign = "center";
      ctx.fillText(isRapid ? "RAPID" : "SCATTER", cx, cy + size + 12);
    });
  }

  return {
    init,
    invalidateMazeCache,
    applyThemeFonts,
    drawArena,
    drawMaze,
    drawPlayer,
    drawBullets,
    drawBombs,
    drawExplosions,
    drawZombies,
    drawFreezeEffect,
    drawDamageFlash,
    drawLowHealthVignette,
    drawHealthPacks,
    drawFloatingTexts,
    beginFrame,
    endFrame,
    drawSpeedBoostPickups,
    drawWeaponPickups,
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
