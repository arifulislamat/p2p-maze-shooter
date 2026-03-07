// ===========================================
// Theme: Retro Neon (built-in default)
// ===========================================
// Every value here was extracted from the original codebase audit.
// This file is the single source of truth for the retro-neon visual style.
// To create a new theme, copy this file, change id/label and any values,
// then register one line in themes/index.js.

const retroNeonTheme = {
  id:    "retro-neon",
  label: "Retro Neon",

  // ---------------------------------------------------------------------------
  // Canvas color tokens — keyed to match CONFIG.COLORS in constants.js.
  // ThemeManager.apply() copies these into CONFIG.COLORS so all rendering code
  // (Renderer, game.js) picks them up automatically via the COLORS.* global.
  // ---------------------------------------------------------------------------
  colors: {
    // --- World / map (already in CONFIG.COLORS) ---
    background:     "#0a0a1a",
    border:         "#2a2a4a",
    wall:           "#2d2d4a",
    wallStroke:     "#4a4a6a",
    wallInner:      "rgba(100,100,180,0.2)",  // inner inset border on wall tiles
    wallShadowDark: "rgba(0,0,0,0.15)",       // bottom-right depth shadow on walls
    wallHighlight:  "rgba(100,100,160,0.15)", // top-left highlight on walls
    gridLine:       "#1a1a2e",                // subtle cell grid overlay
    path:           "#0a0a1a",

    // --- Players (already in CONFIG.COLORS) ---
    p1:             "#00d4ff",
    p1Dark:         "#0099bb",
    p1Spawn:        "#003344",
    p1SpawnBorder:  "#00d4ff",
    p2:             "#ff4444",
    p2Dark:         "#cc2222",
    p2Spawn:        "#330011",
    p2SpawnBorder:  "#ff4444",

    // Raw RGB triplets used in rgba() template literals for vignette / damage flash
    p1RGB:          "0,180,255",
    p2RGB:          "255,60,60",

    // --- Zombies (already in CONFIG.COLORS) ---
    zombie:         "#44ff44",
    zombieGlow:     "#0a1a0a",

    // --- Bombs (already in CONFIG.COLORS) ---
    bomb:           "#ffaa00",
    bombGlow:       "#1a1500",
    bombBody:       "#333",      // bomb body fill circle
    bombSpark:      "#ffff88",   // fuse spark dot
    bombFuseLow:    "#ff3333",   // bomb timer text color when < 33% fuse remaining

    // --- Bullets (already in CONFIG.COLORS) ---
    bullet:         "#f39c12",
    bulletStroke:   "#e67e22",
    bulletP1:       "#88ffff",
    bulletP1Glow:   "#00ffff",
    bulletP2:       "#ff8888",
    bulletP2Glow:   "#ff4444",
    bulletHotWhite: "rgba(255,255,255,0.7)", // hot-white center streak on bullet

    // --- HUD / UI canvas elements (partially in CONFIG.COLORS) ---
    healthGreen:    "#2ecc71",
    healthRed:      "#e74c3c",
    healthBg:       "#333333",
    hudText:        "#ccccee",
    white:          "#ffffff",
    accent:         "#ff6b00",   // corner accents, map name glow, announcement glow
    textLight:      "#aaa",      // light secondary text (maze timer "Next map:")
    textMuted:      "#888",      // muted secondary text (TIME'S UP, P2P label, MAP CHANGED)
    textDim:        "#666",      // less prominent text ("vs", match timer normal, hints)

    // --- Overlays ---
    overlayHudBg:   "rgba(0,0,0,0.5)",   // semi-transparent HUD bar
    overlayModal:   "rgba(0,0,0,0.85)",  // disconnect / game-over modal background
    glassPanelBg:     "rgba(8, 8, 22, 0.88)",
    glassPanelBorder: "rgba(255, 255, 255, 0.28)",
    overlayCountdown: "rgba(0,0,0,0.7)", // countdown number backdrop

    // --- Countdown ---
    countdownGo:    "#44ff44",   // "GO!" text glow color

    // --- Explosions ---
    explosionBase:         "#ff6400",   // danger-zone indicator circle
    explosionParticle:     "#ff7700",   // inner fireball fill
    explosionLight:        "#ffffc8",   // hot white center of fireball
    explosionShockwaveRGB: "255,150,0", // expanding shockwave ring (rgb triplet for rgba())
    explosionSparkRGB:     "255,255,100", // scattered sparks (rgb triplet)

    // --- Freeze effect ---
    freezeOverlay:  "#88ddff",   // icy blue overlay circle
    freezeStroke:   "#aaeeff",   // icy border stroke
    freezeGlow:     "#00ccff",   // glow shadow + "FROZEN" label text

    // --- Health packs (green cross uses healthGreen above) ---
    // (no new keys — drawHealthPacks reuses healthGreen)

    // --- Speed boost pickup ---
    speedBoostYellow: "#ffe600",  // lightning bolt fill + ground circle
    speedBoostStroke: "#fff8a0",  // lightning bolt outline

    // --- Weapon pickups ---
    weaponRapidfire: "#33aaff",   // rapid-fire pickup color (#3af expanded)
    weaponScatter:   "#ff9933",   // scatter pickup color (#f93 expanded)

    // --- Online / connection ---
    disconnectAlert: "#ff4444",   // disconnect overlay glow + text
    reconnectAlert:  "#ffaa00",   // reconnecting overlay glow + text

    // --- Floating damage / event texts ---
    floatingHeal:           "#00ff88",  // health pack "+HP"
    floatingSpeed:          "#ffff00",  // speed boost "⚡ SPEED!"
    floatingWeaponRapid:    "#00aaff",  // weapon "⚡ RAPID FIRE"
    floatingWeaponScatter:  "#ff6600",  // weapon "💥 SCATTER"
  },

  // ---------------------------------------------------------------------------
  // Canvas font strings — keyed to match RENDER_CONFIG.FONTS inside renderer.js.
  // ThemeManager.apply() calls Renderer.applyThemeFonts(theme.fonts.canvas)
  // which does Object.assign(RENDER_CONFIG.FONTS, fontsObj).
  // ---------------------------------------------------------------------------
  fonts: {
    canvas: {
      HUD:            "bold 16px 'JetBrains Mono', 'Courier New', monospace",
      HUD_SMALL:      "10px 'JetBrains Mono', 'Courier New', monospace",
      LABEL:          "bold 12px 'JetBrains Mono', 'Courier New', monospace",
      COUNTDOWN:      "bold 120px 'JetBrains Mono', 'Courier New', monospace",
      RESPAWN:        "bold 20px 'JetBrains Mono', 'Courier New', monospace",
      GAME_OVER:      "bold 60px 'JetBrains Mono', 'Courier New', monospace",
      GAME_OVER_SUB:  "20px 'JetBrains Mono', 'Courier New', monospace",
      DISCONNECT:     "bold 36px 'JetBrains Mono', 'Courier New', monospace",
      DISCONNECT_SUB: "20px 'JetBrains Mono', 'Courier New', monospace",
      ANNOUNCE:       "bold 36px 'JetBrains Mono', 'Courier New', monospace",
      ANNOUNCE_SUB:   "14px 'JetBrains Mono', 'Courier New', monospace",
      // New keys (hardcoded inline in renderer — now exposed for theming)
      BOMB_TIMER:      "bold 14px 'JetBrains Mono', 'Courier New', monospace",
      IN_WORLD_LABEL:  "bold 10px 'JetBrains Mono', 'Courier New', monospace",
      HEALTH_PACK_LABEL: "bold 11px 'JetBrains Mono', 'Courier New', monospace",
    },
  },

  // ---------------------------------------------------------------------------
  // Rendering settings
  // ---------------------------------------------------------------------------
  rendering: {
    glowEnabled:  true,
    glowBlur:     10,    // primary player/bullet glow shadowBlur value
    scanlines:    true,  // CRT scanline overlay on canvas (via body.scanlines class)
    pixelated:    false, // canvas imageRendering: pixelated
    playerShape:  "triangle",
  },

  // ---------------------------------------------------------------------------
  // Sound paths — all null because the game uses 100% procedural Web Audio API
  // synthesis. Zero audio files exist. This section is here for future themes
  // that may want to use audio samples.
  // ---------------------------------------------------------------------------
  sounds: {
    shoot:     null,
    hit:       null,
    death:     null,
    explosion: null,
    freeze:    null,
    countdown: null,
    go:        null,
    respawn:   null,
    mazeChange: null,
    gameOver:  null,
    victory:   null,
    connected: null,
    ambience:  null,
  },

  // ---------------------------------------------------------------------------
  // CSS custom properties — injected into :root by ThemeManager.apply().
  // Keys starting with -- map to every color that drives the DOM/CSS UI.
  // The :root block in styles.css still declares these with fallback defaults
  // so the UI looks correct before JS runs (cold load / no-JS).
  // ---------------------------------------------------------------------------
  cssVars: {
    // Backgrounds
    "--bg-deep":         "#07070f",
    "--bg-dark":         "#0a0a1a",
    "--bg-panel":        "#0d0d1a",
    "--bg-elevated":     "#1a1a2e",

    // Accent (orange)
    "--accent":          "#ff6b00",
    "--accent-hover":    "#cc5500",
    "--accent-glow":     "rgba(255, 107, 0, 0.3)",
    "--accent-dim":      "rgba(255, 107, 0, 0.08)",

    // Borders
    "--border-dark":     "#2a2a4a",
    "--border-subtle":   "#1a1a2e",

    // Text
    "--text-primary":    "#c8c8e0",
    "--text-muted":      "#888",
    "--text-dim":        "#555",
    "--text-dark":       "#333",

    // Player colors (used in lobby controls-help HTML inline styles)
    "--p1":              "#00d4ff",
    "--p2":              "#ff4444",

    // Status
    "--status-ok":       "#2ecc71",
    "--status-error":    "#e74c3c",

    // Button text (hardcoded #000 in .btn-primary / .btn-secondary:hover)
    "--btn-text":        "#000",

    // Overlay / modal text (hardcoded #fff in #overlay h2 and #leaveConfirm:hover)
    "--overlay-text":    "#fff",

    // Author credit link (hardcoded #00d4ff in .author-credit a)
    "--author-link":     "#00d4ff",

    // Keyboard hint widget (hardcoded #444 border, #ccc text)
    "--key-border":      "#444",
    "--key-text":        "#ccc",

    // Leave-cancel button hover background
    "--leave-cancel-hover": "#222240",

    // Mobile shoot button
    "--shoot-btn-bg":     "#c0392b",
    "--shoot-btn-border": "#e74c3c",
    "--shoot-btn-text":   "#fff",

    /* Maze card */
    "--card-bg":            "rgba(14,14,30,.7)",
    "--card-border":        "rgba(255,255,255,.06)",
    "--card-hover-bg":      "rgba(20,20,42,.9)",
    "--card-hover-border":  "rgba(255,255,255,.12)",
    "--card-shimmer-color": "rgba(255,255,255,.04)",

    /* Touch controls */
    "--touch-area-bg":        "transparent",
    "--joystick-base-bg":     "rgba(255,255,255,0.06)",
    "--joystick-base-border": "rgba(255,255,255,0.2)",
    "--joystick-knob-bg":     "rgba(255,255,255,0.55)",
    "--joystick-knob-border": "rgba(255,255,255,0.85)",
  },
};
