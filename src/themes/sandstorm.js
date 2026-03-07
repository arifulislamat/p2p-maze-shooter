// ===========================================
// Theme: Sandstorm
// ===========================================
// A warm light theme with desert sand tones and burnt-amber accents.
// Designed for daytime play and accessibility — high contrast on warm
// backgrounds reduces eye strain while remaining visually distinctive.
// Psychology: warm tones create invitation & comfort → lower barrier to entry
// for casual players, younger/older audiences.

const sandstormTheme = {
  id:    "sandstorm",
  label: "Sandstorm",

  // ---------------------------------------------------------------------------
  // Canvas color tokens — keyed to match CONFIG.COLORS in constants.js.
  // ---------------------------------------------------------------------------
  colors: {
    // --- World / map ---
    background:     "#e8ddc8",
    border:         "#c0b49a",
    wall:           "#baa888",
    wallStroke:     "#a09078",
    wallInner:      "rgba(80,60,30,0.08)",
    wallShadowDark: "rgba(0,0,0,0.06)",
    wallHighlight:  "rgba(255,255,255,0.18)",
    gridLine:       "#d4c8ae",
    path:           "#e8ddc8",

    // --- Players ---
    p1:             "#0088cc",
    p1Dark:         "#006699",
    p1Spawn:        "#c0dae8",
    p1SpawnBorder:  "#0088cc",
    p2:             "#cc3344",
    p2Dark:         "#992233",
    p2Spawn:        "#e8c0c4",
    p2SpawnBorder:  "#cc3344",
    p1RGB:          "0,136,204",
    p2RGB:          "204,51,68",

    // --- Zombies ---
    zombie:         "#228844",
    zombieGlow:     "#d8e8d0",

    // --- Bombs ---
    bomb:           "#cc7700",
    bombGlow:       "#e8dcc0",
    bombBody:       "#8a7a60",
    bombSpark:      "#ffe888",
    bombFuseLow:    "#cc2233",

    // --- Bullets ---
    bullet:         "#cc7700",
    bulletStroke:    "#aa5500",
    bulletP1:       "#44aadd",
    bulletP1Glow:   "#0088cc",
    bulletP2:       "#dd6666",
    bulletP2Glow:   "#cc3344",
    bulletHotWhite: "rgba(255,255,255,0.6)",

    // --- HUD / UI ---
    healthGreen:    "#228844",
    healthRed:      "#cc2233",
    healthBg:       "#c0b49a",
    hudText:        "#2a2418",
    white:          "#1a1410",
    accent:         "#c06000",
    textLight:      "#5a5040",
    textMuted:      "#7a7060",
    textDim:        "#9a9080",

    // --- Overlays ---
    overlayHudBg:     "rgba(232,221,200,0.6)",
    overlayModal:     "rgba(232,221,200,0.92)",
    overlayCountdown: "rgba(232,221,200,0.8)",

    // --- Countdown ---
    countdownGo:    "#228844",

    // --- Explosions ---
    explosionBase:         "#cc6600",
    explosionParticle:     "#dd7700",
    explosionLight:        "#fff8d8",
    explosionShockwaveRGB: "200,120,0",
    explosionSparkRGB:     "220,200,80",

    // --- Freeze effect ---
    freezeOverlay:  "#70b0d0",
    freezeStroke:   "#90c8e0",
    freezeGlow:     "#0088bb",

    // --- Speed boost pickup ---
    speedBoostYellow: "#ccaa00",
    speedBoostStroke: "#e0cc44",

    // --- Weapon pickups ---
    weaponRapidfire: "#2288cc",
    weaponScatter:   "#cc6622",

    // --- Online / connection ---
    disconnectAlert: "#cc2233",
    reconnectAlert:  "#cc7700",

    // --- Floating damage / event texts ---
    floatingHeal:           "#228844",
    floatingSpeed:          "#aa8800",
    floatingWeaponRapid:    "#0077bb",
    floatingWeaponScatter:  "#cc5500",
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
    glowEnabled:  false,     // no glow on light backgrounds — looks washed out
    glowBlur:     0,
    scanlines:    false,     // CRT scanlines look wrong on light themes
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
    "--bg-deep":         "#f0e8d4",
    "--bg-dark":         "#e8ddc8",
    "--bg-panel":        "#ddd0b8",
    "--bg-elevated":     "#d0c4a8",

    "--accent":          "#c06000",
    "--accent-hover":    "#a04e00",
    "--accent-glow":     "rgba(192, 96, 0, 0.2)",
    "--accent-dim":      "rgba(192, 96, 0, 0.06)",

    "--border-dark":     "#c0b49a",
    "--border-subtle":   "#d0c4ae",

    "--text-primary":    "#2a2418",
    "--text-muted":      "#7a7060",
    "--text-dim":        "#9a9080",
    "--text-dark":       "#b0a890",

    "--p1":              "#0088cc",
    "--p2":              "#cc3344",

    "--status-ok":       "#228844",
    "--status-error":    "#cc2233",

    "--btn-text":        "#fff",
    "--overlay-text":    "#2a2418",
    "--author-link":     "#0088cc",

    "--key-border":      "#b0a48a",
    "--key-text":        "#4a4030",

    "--leave-cancel-hover": "#c8bca4",

    "--shoot-btn-bg":     "#a02233",
    "--shoot-btn-border": "#cc3344",
    "--shoot-btn-text":   "#fff",

    /* Maze card */
    "--card-bg":            "rgba(221,208,184,.78)",
    "--card-border":        "rgba(0,0,0,.07)",
    "--card-hover-bg":      "rgba(210,196,168,.92)",
    "--card-hover-border":  "rgba(0,0,0,.14)",
    "--card-shimmer-color": "rgba(255,255,255,.22)",

    /* Touch controls — darkened for visibility on light background */
    "--touch-area-bg":        "rgba(80, 50, 15, 0.18)",
    "--joystick-base-bg":     "rgba(100, 65, 15, 0.2)",
    "--joystick-base-border": "rgba(80, 50, 10, 0.5)",
    "--joystick-knob-bg":     "rgba(70, 40, 5, 0.6)",
    "--joystick-knob-border": "rgba(50, 25, 0, 0.8)",
  },
};
