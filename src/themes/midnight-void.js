// ===========================================
// Theme: Midnight Void
// ===========================================
// A premium ultra-dark theme with deep indigo undertones and electric
// cyan/magenta accents. Designed for immersive late-night sessions.
// Psychology: darkness narrows visual focus → heightened intensity & flow state.

const midnightVoidTheme = {
  id:    "midnight-void",
  label: "Midnight Void",

  // ---------------------------------------------------------------------------
  // Canvas color tokens — keyed to match CONFIG.COLORS in constants.js.
  // ---------------------------------------------------------------------------
  colors: {
    // --- World / map ---
    background:     "#04040e",
    border:         "#1a1a3a",
    wall:           "#12122e",
    wallStroke:     "#2a2a5a",
    wallInner:      "rgba(80,80,200,0.12)",
    wallShadowDark: "rgba(0,0,0,0.25)",
    wallHighlight:  "rgba(100,100,220,0.08)",
    gridLine:       "#0e0e24",
    path:           "#04040e",

    // --- Players ---
    p1:             "#00e5ff",
    p1Dark:         "#00a0b8",
    p1Spawn:        "#001a24",
    p1SpawnBorder:  "#00e5ff",
    p2:             "#ff2d6a",
    p2Dark:         "#c4204e",
    p2Spawn:        "#24001a",
    p2SpawnBorder:  "#ff2d6a",
    p1RGB:          "0,229,255",
    p2RGB:          "255,45,106",

    // --- Zombies ---
    zombie:         "#00ff88",
    zombieGlow:     "#001a0e",

    // --- Bombs ---
    bomb:           "#ff8800",
    bombGlow:       "#1a1000",
    bombBody:       "#2a2a3e",
    bombSpark:      "#ffe888",
    bombFuseLow:    "#ff2244",

    // --- Bullets ---
    bullet:         "#e8a020",
    bulletStroke:    "#cc7a18",
    bulletP1:       "#80ffff",
    bulletP1Glow:   "#00e5ff",
    bulletP2:       "#ff80a0",
    bulletP2Glow:   "#ff2d6a",
    bulletHotWhite: "rgba(255,255,255,0.75)",

    // --- HUD / UI ---
    healthGreen:    "#00e89a",
    healthRed:      "#ff2d5a",
    healthBg:       "#1a1a30",
    hudText:        "#c0c0ee",
    white:          "#ffffff",
    accent:         "#7b5cff",
    textLight:      "#9090b8",
    textMuted:      "#606088",
    textDim:        "#404060",

    // --- Overlays ---
    overlayHudBg:     "rgba(4,4,14,0.6)",
    overlayModal:     "rgba(4,4,14,0.92)",
    overlayCountdown: "rgba(4,4,14,0.8)",

    // --- Countdown ---
    countdownGo:    "#00ff88",

    // --- Explosions ---
    explosionBase:         "#ff5500",
    explosionParticle:     "#ff7020",
    explosionLight:        "#ffffd0",
    explosionShockwaveRGB: "255,120,0",
    explosionSparkRGB:     "255,240,100",

    // --- Freeze effect ---
    freezeOverlay:  "#80d0ff",
    freezeStroke:   "#a0e0ff",
    freezeGlow:     "#00b0ff",

    // --- Speed boost pickup ---
    speedBoostYellow: "#ffe040",
    speedBoostStroke: "#fff8a0",

    // --- Weapon pickups ---
    weaponRapidfire: "#40aaff",
    weaponScatter:   "#ff8833",

    // --- Online / connection ---
    disconnectAlert: "#ff2d5a",
    reconnectAlert:  "#ff8800",

    // --- Floating damage / event texts ---
    floatingHeal:           "#00ff88",
    floatingSpeed:          "#ffe040",
    floatingWeaponRapid:    "#40aaff",
    floatingWeaponScatter:  "#ff6600",
  },

  // ---------------------------------------------------------------------------
  // Canvas font strings
  // ---------------------------------------------------------------------------
  fonts: {
    canvas: {
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
  },

  // ---------------------------------------------------------------------------
  // Rendering settings
  // ---------------------------------------------------------------------------
  rendering: {
    glowEnabled:  true,
    glowBlur:     14,
    scanlines:    true,
    pixelated:    false,
    playerShape:  "triangle",
  },

  // ---------------------------------------------------------------------------
  // Sound paths
  // ---------------------------------------------------------------------------
  sounds: {
    shoot: null, hit: null, death: null, explosion: null, freeze: null,
    countdown: null, go: null, respawn: null, mazeChange: null,
    gameOver: null, victory: null, connected: null, ambience: null,
  },

  // ---------------------------------------------------------------------------
  // CSS custom properties
  // ---------------------------------------------------------------------------
  cssVars: {
    "--bg-deep":         "#02020a",
    "--bg-dark":         "#04040e",
    "--bg-panel":        "#0a0a1e",
    "--bg-elevated":     "#14142e",

    "--accent":          "#7b5cff",
    "--accent-hover":    "#6344e0",
    "--accent-glow":     "rgba(123, 92, 255, 0.35)",
    "--accent-dim":      "rgba(123, 92, 255, 0.08)",

    "--border-dark":     "#1a1a3a",
    "--border-subtle":   "#10102a",

    "--text-primary":    "#c0c0ee",
    "--text-muted":      "#606088",
    "--text-dim":        "#404060",
    "--text-dark":       "#202040",

    "--p1":              "#00e5ff",
    "--p2":              "#ff2d6a",

    "--status-ok":       "#00e89a",
    "--status-error":    "#ff2d5a",

    "--btn-text":        "#fff",
    "--overlay-text":    "#fff",
    "--author-link":     "#7b5cff",

    "--key-border":      "#2a2a4a",
    "--key-text":        "#9090b8",

    "--leave-cancel-hover": "#18183a",

    "--shoot-btn-bg":     "#a0204e",
    "--shoot-btn-border": "#ff2d6a",
    "--shoot-btn-text":   "#fff",

    /* Maze card */
    "--card-bg":            "rgba(10,10,30,.74)",
    "--card-border":        "rgba(123,92,255,.1)",
    "--card-hover-bg":      "rgba(16,16,46,.92)",
    "--card-hover-border":  "rgba(123,92,255,.22)",
    "--card-shimmer-color": "rgba(123,92,255,.06)",

    /* Touch controls */
    "--touch-area-bg":        "transparent",
    "--joystick-base-bg":     "rgba(255,255,255,0.06)",
    "--joystick-base-border": "rgba(255,255,255,0.2)",
    "--joystick-knob-bg":     "rgba(255,255,255,0.55)",
    "--joystick-knob-border": "rgba(255,255,255,0.85)",
  },
};
