# Adding a New Theme

The game's visual style is fully data-driven. Creating a new theme requires **zero engine changes** — just one theme file, one `<script>` tag, and one registry line.

---

## Quick Overview

A theme is a plain JavaScript object that controls:

- **Canvas colors** (~60 tokens) — every color the renderer draws on the `<canvas>`.
- **Canvas fonts** (13 keys) — every font string used for HUD, countdown, announcements, etc.
- **Rendering options** — glow, scanlines, pixel art mode, player shape.
- **Sound overrides** — reserved for future audio sample support (currently all `null`).
- **CSS custom properties** (~30 vars) — every color the DOM/CSS lobby UI uses.

When `ThemeManager.apply(themeId)` is called:

1. `CONFIG.COLORS` is mutated in-place → all canvas rendering picks up new colors immediately.
2. `RENDER_CONFIG.FONTS` is patched → all text elements use new fonts.
3. CSS vars are injected into `:root` → the entire lobby/HUD DOM updates.
4. Canvas rendering hints are applied (pixelated mode, etc.).
5. Selection is saved to `localStorage` → persists across reloads.
6. A `themechange` CustomEvent fires → the game loop invalidates caches (e.g. redraws the maze).

---

## Step-by-Step

### 1. Copy the reference theme

Start by duplicating `src/themes/retro-neon.js`. This file is the most thoroughly commented and contains every key the engine reads:

```bash
cp src/themes/retro-neon.js src/themes/my-theme.js
```

### 2. Rename the variable and set metadata

At the top of your new file, change the variable name and the `id`/`label`:

```javascript
const myTheme = {
  id:    "my-theme",     // unique slug — used as the registry key and localStorage value
  label: "My Theme",     // human-readable name shown in the theme selector UI
  // …
};
```

> **Naming rules:** The `id` must be a valid JS object key (lowercase, hyphens OK). The `label` can be any string.

### 3. Customize the color tokens

The `colors` object has ~60 keys grouped by category. Every key maps 1:1 to a property in `CONFIG.COLORS` that the renderer reads. Change the values to match your palette:

```javascript
colors: {
  // --- World / map ---
  background:     "#0a0a1a",     // canvas clear color + floor fill
  border:         "#2a2a4a",     // outer border of the maze
  wall:           "#2d2d4a",     // main wall tile fill
  wallStroke:     "#4a4a6a",     // wall tile outline
  wallInner:      "rgba(…)",     // inner inset highlight on wall tiles
  wallShadowDark: "rgba(…)",     // bottom-right depth shadow on walls
  wallHighlight:  "rgba(…)",     // top-left highlight on walls
  gridLine:       "#1a1a2e",     // subtle cell grid overlay
  path:           "#0a0a1a",     // walkable floor fill

  // --- Players ---
  p1:             "#00d4ff",     // Player 1 primary color
  p1Dark:         "#0099bb",     // Player 1 darker shade (shadow/stroke)
  p1Spawn:        "#003344",     // P1 spawn cell fill
  p1SpawnBorder:  "#00d4ff",     // P1 spawn cell border
  p2:             "#ff4444",     // Player 2 primary color
  p2Dark:         "#cc2222",     // Player 2 darker shade
  p2Spawn:        "#330011",     // P2 spawn cell fill
  p2SpawnBorder:  "#ff4444",     // P2 spawn cell border
  p1RGB:          "0,180,255",   // bare R,G,B triplet for P1 (used in rgba() animations)
  p2RGB:          "255,60,60",   // bare R,G,B triplet for P2

  // --- Zombies ---
  zombie:         "#44ff44",     // zombie body fill
  zombieGlow:     "#0a1a0a",     // zombie glow shadow color

  // --- Bombs ---
  bomb:           "#ffaa00",     // bomb glow ring + timer text
  bombGlow:       "#1a1500",     // bomb shadow color
  bombBody:       "#333",        // bomb body fill circle
  bombSpark:      "#ffff88",     // fuse spark dot
  bombFuseLow:    "#ff3333",     // timer text when < 33% fuse remaining

  // --- Bullets ---
  bullet:         "#f39c12",     // default bullet fill
  bulletStroke:   "#e67e22",     // bullet outline
  bulletP1:       "#88ffff",     // Player 1 bullet fill
  bulletP1Glow:   "#00ffff",     // P1 bullet glow
  bulletP2:       "#ff8888",     // Player 2 bullet fill
  bulletP2Glow:   "#ff4444",     // P2 bullet glow
  bulletHotWhite: "rgba(255,255,255,0.7)",  // hot-white center streak

  // --- HUD / UI ---
  healthGreen:    "#2ecc71",     // healthy HP bar color
  healthRed:      "#e74c3c",     // low HP bar color
  healthBg:       "#333333",     // HP bar background
  hudText:        "#ccccee",     // HUD text color
  white:          "#ffffff",     // pure white (labels, outlines)
  accent:         "#ff6b00",     // announcement glow, corner accents
  textLight:      "#aaa",        // light secondary text
  textMuted:      "#888",        // muted secondary text
  textDim:        "#666",        // less prominent text

  // --- Overlays ---
  overlayHudBg:     "rgba(0,0,0,0.5)",    // semi-transparent HUD bar
  overlayModal:     "rgba(0,0,0,0.85)",   // disconnect / game-over backdrop
  overlayCountdown: "rgba(0,0,0,0.7)",    // countdown number backdrop

  // --- Countdown ---
  countdownGo:    "#44ff44",     // "GO!" text glow color

  // --- Explosions ---
  explosionBase:         "#ff6400",       // danger-zone indicator
  explosionParticle:     "#ff7700",       // inner fireball fill
  explosionLight:        "#ffffc8",       // hot white center
  explosionShockwaveRGB: "255,150,0",     // shockwave ring (R,G,B triplet)
  explosionSparkRGB:     "255,255,100",   // scattered sparks (R,G,B triplet)

  // --- Freeze effect ---
  freezeOverlay:  "#88ddff",     // icy blue overlay circle
  freezeStroke:   "#aaeeff",     // icy border stroke
  freezeGlow:     "#00ccff",     // glow shadow + "FROZEN" label

  // --- Speed boost pickup ---
  speedBoostYellow: "#ffe600",   // lightning bolt fill + ground circle
  speedBoostStroke: "#fff8a0",   // lightning bolt outline

  // --- Weapon pickups ---
  weaponRapidfire: "#33aaff",    // rapid-fire pickup color
  weaponScatter:   "#ff9933",    // scatter pickup color

  // --- Online / connection ---
  disconnectAlert: "#ff4444",    // disconnect overlay glow + text
  reconnectAlert:  "#ffaa00",    // reconnecting overlay glow + text

  // --- Floating texts ---
  floatingHeal:          "#00ff88",  // "+HP" text
  floatingSpeed:         "#ffff00",  // "⚡ SPEED!" text
  floatingWeaponRapid:   "#00aaff",  // "⚡ RAPID FIRE" text
  floatingWeaponScatter: "#ff6600",  // "💥 SCATTER" text
},
```

> **`*RGB` keys** are bare triplets (`"R,G,B"`) without the `rgba()` wrapper. They're used in template literals like `` `rgba(${COLORS.p1RGB}, ${alpha})` `` for animation-driven transparency. Don't add the `rgba()` wrapper — just provide the three numbers.

### 4. Customize the fonts

The `fonts.canvas` object controls every text element drawn on the `<canvas>`:

```javascript
fonts: {
  canvas: {
    HUD:               "bold 16px Courier New",
    HUD_SMALL:         "10px Courier New",
    LABEL:             "bold 12px Courier New",
    COUNTDOWN:         "bold 120px Courier New",
    RESPAWN:           "bold 20px Courier New",
    GAME_OVER:         "bold 60px Courier New",
    GAME_OVER_SUB:     "16px Courier New",
    DISCONNECT:        "bold 36px Courier New",
    DISCONNECT_SUB:    "16px Courier New",
    ANNOUNCE:          "bold 36px Courier New",
    ANNOUNCE_SUB:      "14px Courier New",
    BOMB_TIMER:        "bold 14px Courier New",
    IN_WORLD_LABEL:    "bold 10px Courier New",
    HEALTH_PACK_LABEL: "bold 11px Courier New",
  },
},
```

> Use any web-safe font or system font stack. All fonts are standard CSS font strings.

### 5. Set rendering options

```javascript
rendering: {
  glowEnabled:  true,         // enable glow (shadowBlur) on players/bullets
  glowBlur:     10,           // shadowBlur radius for glow effects
  scanlines:    true,         // CRT scanline overlay (adds `scanlines` class to body)
  pixelated:    false,        // canvas imageRendering: pixelated (for pixel-art themes)
  playerShape:  "triangle",   // player shape: "triangle" (only option currently)
},
```

### 6. Set sound overrides (optional)

Currently all sounds are procedurally synthesized. The `sounds` section is a placeholder for future audio sample support. Set all values to `null`:

```javascript
sounds: {
  shoot: null, hit: null, death: null, explosion: null,
  freeze: null, countdown: null, go: null, respawn: null,
  mazeChange: null, gameOver: null, victory: null, connected: null,
  ambience: null,
},
```

### 7. Define CSS custom properties

The `cssVars` object is injected into `:root` to style the DOM lobby, settings panel, modals, and HUD elements that live outside the canvas. The CSS in `styles.css` uses `var(--token)` references:

```javascript
cssVars: {
  // Backgrounds
  "--bg-deep":         "#07070f",      // deepest page background
  "--bg-dark":         "#0a0a1a",      // main panel background
  "--bg-panel":        "#0d0d1a",      // card/panel background
  "--bg-elevated":     "#1a1a2e",      // elevated surfaces (inputs, etc.)

  // Accent
  "--accent":          "#ff6b00",      // primary action color
  "--accent-hover":    "#cc5500",      // button hover state
  "--accent-glow":     "rgba(255,107,0,0.3)",  // glow around accent elements
  "--accent-dim":      "rgba(255,107,0,0.08)", // subtle accent tint

  // Borders
  "--border-dark":     "#2a2a4a",
  "--border-subtle":   "#1a1a2e",

  // Text
  "--text-primary":    "#c8c8e0",
  "--text-muted":      "#888",
  "--text-dim":        "#555",
  "--text-dark":       "#333",

  // Player colors (controls-help section)
  "--p1":              "#00d4ff",
  "--p2":              "#ff4444",

  // Status indicators
  "--status-ok":       "#2ecc71",
  "--status-error":    "#e74c3c",

  // Buttons
  "--btn-text":        "#000",

  // Overlays
  "--overlay-text":    "#fff",

  // Links
  "--author-link":     "#00d4ff",

  // Keyboard hints
  "--key-border":      "#444",
  "--key-text":        "#ccc",

  // Leave/cancel button
  "--leave-cancel-hover": "#222240",

  // Mobile shoot button
  "--shoot-btn-bg":     "#c0392b",
  "--shoot-btn-border": "#e74c3c",
  "--shoot-btn-text":   "#fff",

  // Maze cards
  "--card-bg":            "rgba(14,14,30,.7)",
  "--card-border":        "rgba(255,255,255,.06)",
  "--card-hover-bg":      "rgba(20,20,42,.9)",
  "--card-hover-border":  "rgba(255,255,255,.12)",
  "--card-shimmer-color": "rgba(255,255,255,.04)",
},
```

### 8. Register the theme

Open `src/themes/index.js` and add your theme to the `themes` object:

```javascript
const ThemeRegistry = {
  themes: {
    [retroNeonTheme.id]:    retroNeonTheme,
    [midnightVoidTheme.id]: midnightVoidTheme,
    [sandstormTheme.id]:    sandstormTheme,
    [cyberSakuraTheme.id]:  cyberSakuraTheme,
    [myTheme.id]:           myTheme,           // ← add this line
  },
  defaultTheme: "sandstorm",
};
```

### 9. Add the script tag

Open `src/index.html` and add a `<script>` tag for your theme file **before** `themes/index.js`:

```html
<script src="themes/retro-neon.js"></script>
<script src="themes/midnight-void.js"></script>
<script src="themes/sandstorm.js"></script>
<script src="themes/cyber-sakura.js"></script>
<script src="themes/my-theme.js"></script>      <!-- ← add this line -->
<script src="themes/index.js"></script>
<script src="core/ThemeManager.js"></script>
```

> **Order matters.** Theme files must load before `themes/index.js` (which references them) and before `core/ThemeManager.js` (which queries the registry).

### 10. Test it

Open `src/index.html` in a browser. Your theme should appear in the settings panel (⚙ gear icon). Click it to apply. Verify:

- [ ] All maze walls, floors, and grid lines use your colors
- [ ] Player 1 and Player 2 are visually distinct
- [ ] Bullets, bombs, zombies render correctly
- [ ] HUD (health bars, scores, timer) is legible
- [ ] Lobby UI (buttons, panels, text) uses your CSS vars
- [ ] Explosions, freeze effects, floating texts are visible
- [ ] Theme persists after page reload

---

## File Summary

After adding a theme, you'll have touched exactly **3 files**:

| File | Change |
|---|---|
| `src/themes/my-theme.js` | New file — your theme definition |
| `src/themes/index.js` | One line — register the theme |
| `src/index.html` | One line — add the `<script>` tag |

No changes to `renderer.js`, `game.js`, `constants.js`, or any other engine file.

---

## Tips

**Start from an existing theme.** Don't write a theme from scratch. Copy whichever built-in theme is closest to your desired look:

| If you want… | Start from |
|---|---|
| Dark neon aesthetic | `retro-neon.js` |
| Ultra-dark minimalist | `midnight-void.js` |
| Light / warm palette | `sandstorm.js` |
| Colorful / distinctive accents | `cyber-sakura.js` |

**Ensure sufficient contrast.** Players, bullets, and zombies must be clearly distinguishable from the background and from each other. Test on both your monitor and a mobile screen.

**The `*RGB` keys are critical.** Themes that omit `p1RGB`, `p2RGB`, `explosionShockwaveRGB`, or `explosionSparkRGB` will break `rgba()` template literals in the renderer. Always include them as bare `"R,G,B"` triplets.

**CSS vars have fallback defaults.** The `:root` block in `styles.css` declares all custom properties with fallback values, so the UI looks correct even before JavaScript runs. Your theme overrides these at runtime.

**Test the lobby and in-game separately.** The lobby uses CSS custom properties (`cssVars`), while the canvas uses `colors`. A theme that looks great in-game but has illegible lobby text is incomplete.

---

## Architecture Reference

For deeper technical details on how the theme system is wired, see the [Theme System section in architecture.md](architecture.md#theme-system).
