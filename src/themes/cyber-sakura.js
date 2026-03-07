// ===========================================
// Theme: Cyber Sakura
// ===========================================
// Japanese-inspired cyberpunk — deep charcoal with cherry blossom pink
// and jade green accents. Designed for maximum visual shareability.
// Psychology: Aesthetic-Usability Effect → beautiful UIs feel easier to use.
// Pink/magenta tones broaden gender appeal beyond typical "gamer" palettes.
// Cultural motif creates emotional resonance → players form identity attachment.

const cyberSakuraTheme = {
  id:    "cyber-sakura",
  label: "Cyber Sakura",

  // ---------------------------------------------------------------------------
  // Canvas color tokens
  // ---------------------------------------------------------------------------
  colors: {
    // --- World / map ---
    background:     "#0e0a10",
    border:         "#2e2234",
    wall:           "#241c2a",
    wallStroke:     "#3e3248",
    wallInner:      "rgba(180,80,140,0.1)",
    wallShadowDark: "rgba(0,0,0,0.18)",
    wallHighlight:  "rgba(200,120,180,0.08)",
    gridLine:       "#1a141e",
    path:           "#0e0a10",

    // --- Players ---
    p1:             "#00dda0",
    p1Dark:         "#00aa78",
    p1Spawn:        "#002a1e",
    p1SpawnBorder:  "#00dda0",
    p2:             "#ff5090",
    p2Dark:         "#cc3068",
    p2Spawn:        "#2a0018",
    p2SpawnBorder:  "#ff5090",
    p1RGB:          "0,221,160",
    p2RGB:          "255,80,144",

    // --- Zombies ---
    zombie:         "#88ff44",
    zombieGlow:     "#0e1a08",

    // --- Bombs ---
    bomb:           "#ffaa00",
    bombGlow:       "#1a1200",
    bombBody:       "#302830",
    bombSpark:      "#ffe888",
    bombFuseLow:    "#ff3355",

    // --- Bullets ---
    bullet:         "#e8a020",
    bulletStroke:    "#cc7a18",
    bulletP1:       "#80ffcc",
    bulletP1Glow:   "#00dda0",
    bulletP2:       "#ff80aa",
    bulletP2Glow:   "#ff5090",
    bulletHotWhite: "rgba(255,255,255,0.7)",

    // --- HUD / UI ---
    healthGreen:    "#00dda0",
    healthRed:      "#ff3060",
    healthBg:       "#2a2230",
    hudText:        "#d8c8e0",
    white:          "#ffffff",
    accent:         "#ff5090",
    textLight:      "#a090b0",
    textMuted:      "#706080",
    textDim:        "#504060",

    // --- Overlays ---
    overlayHudBg:     "rgba(14,10,16,0.6)",
    overlayModal:     "rgba(14,10,16,0.92)",
    glassPanelBg:     "rgba(18, 8, 20, 0.90)",
    glassPanelBorder: "rgba(255, 160, 220, 0.22)",
    overlayCountdown: "rgba(14,10,16,0.8)",

    // --- Countdown ---
    countdownGo:    "#00ff88",

    // --- Explosions ---
    explosionBase:         "#ff5500",
    explosionParticle:     "#ff7020",
    explosionLight:        "#ffffd0",
    explosionShockwaveRGB: "255,120,40",
    explosionSparkRGB:     "255,200,100",

    // --- Freeze effect ---
    freezeOverlay:  "#88ccee",
    freezeStroke:   "#a0ddff",
    freezeGlow:     "#00aadd",

    // --- Speed boost pickup ---
    speedBoostYellow: "#ffe040",
    speedBoostStroke: "#fff8a0",

    // --- Weapon pickups ---
    weaponRapidfire: "#40bbff",
    weaponScatter:   "#ff8833",

    // --- Online / connection ---
    disconnectAlert: "#ff3060",
    reconnectAlert:  "#ffaa00",

    // --- Floating damage / event texts ---
    floatingHeal:           "#00ff88",
    floatingSpeed:          "#ffe040",
    floatingWeaponRapid:    "#40bbff",
    floatingWeaponScatter:  "#ff6600",
  },

  // ---------------------------------------------------------------------------
  // Canvas font strings
  // ---------------------------------------------------------------------------
  fonts: {
    canvas: {
      HUD:              "bold 16px 'JetBrains Mono', 'Courier New', monospace",
      HUD_SMALL:        "10px 'JetBrains Mono', 'Courier New', monospace",
      LABEL:            "bold 12px 'JetBrains Mono', 'Courier New', monospace",
      COUNTDOWN:        "bold 120px 'JetBrains Mono', 'Courier New', monospace",
      RESPAWN:          "bold 20px 'JetBrains Mono', 'Courier New', monospace",
      GAME_OVER:        "bold 60px 'JetBrains Mono', 'Courier New', monospace",
      GAME_OVER_SUB:    "20px 'JetBrains Mono', 'Courier New', monospace",
      DISCONNECT:       "bold 36px 'JetBrains Mono', 'Courier New', monospace",
      DISCONNECT_SUB:   "20px 'JetBrains Mono', 'Courier New', monospace",
      ANNOUNCE:         "bold 36px 'JetBrains Mono', 'Courier New', monospace",
      ANNOUNCE_SUB:     "14px 'JetBrains Mono', 'Courier New', monospace",
      BOMB_TIMER:       "bold 14px 'JetBrains Mono', 'Courier New', monospace",
      IN_WORLD_LABEL:   "bold 10px 'JetBrains Mono', 'Courier New', monospace",
      HEALTH_PACK_LABEL:"bold 11px 'JetBrains Mono', 'Courier New', monospace",
    },
  },

  // ---------------------------------------------------------------------------
  // Rendering settings
  // ---------------------------------------------------------------------------
  rendering: {
    glowEnabled:  true,
    glowBlur:     12,
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
    "--bg-deep":         "#0a080c",
    "--bg-dark":         "#0e0a10",
    "--bg-panel":        "#16101a",
    "--bg-elevated":     "#221a28",

    "--accent":          "#ff5090",
    "--accent-hover":    "#e03878",
    "--accent-glow":     "rgba(255, 80, 144, 0.3)",
    "--accent-dim":      "rgba(255, 80, 144, 0.08)",

    "--border-dark":     "#2e2234",
    "--border-subtle":   "#1e1424",

    "--text-primary":    "#d8c8e0",
    "--text-muted":      "#706080",
    "--text-dim":        "#504060",
    "--text-dark":       "#302838",

    "--p1":              "#00dda0",
    "--p2":              "#ff5090",

    "--status-ok":       "#00dda0",
    "--status-error":    "#ff3060",

    "--btn-text":        "#fff",
    "--overlay-text":    "#fff",
    "--author-link":     "#ff5090",

    "--key-border":      "#3a2e42",
    "--key-text":        "#a090b0",

    "--leave-cancel-hover": "#201828",

    "--shoot-btn-bg":     "#cc2860",
    "--shoot-btn-border": "#ff5090",
    "--shoot-btn-text":   "#fff",

    /* Maze card */
    "--card-bg":            "rgba(22,16,26,.74)",
    "--card-border":        "rgba(255,80,144,.08)",
    "--card-hover-bg":      "rgba(34,26,40,.92)",
    "--card-hover-border":  "rgba(255,80,144,.2)",
    "--card-shimmer-color": "rgba(255,80,144,.06)",

    /* Touch controls */
    "--touch-area-bg":        "transparent",
    "--joystick-base-bg":     "rgba(255,255,255,0.06)",
    "--joystick-base-border": "rgba(255,255,255,0.2)",
    "--joystick-knob-bg":     "rgba(255,255,255,0.55)",
    "--joystick-knob-border": "rgba(255,255,255,0.85)",
  },
};
