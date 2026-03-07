// ===========================================
// ThemeManager — Runtime Theme Switcher
// ===========================================
// Singleton IIFE. Call ThemeManager.init() once at game startup (before any
// rendering). Call ThemeManager.apply(themeId) to switch themes at runtime.
//
// When a theme is applied:
//   1. CONFIG.COLORS is mutated in-place so all rendering code picks up new
//      colors immediately via the existing COLORS.* global (no renderer changes).
//   2. Renderer.applyThemeFonts() patches RENDER_CONFIG.FONTS inside the
//      Renderer IIFE so font strings update immediately.
//   3. CSS custom properties are injected into :root so all DOM/CSS UI updates.
//   4. canvas.style.imageRendering is set (pixelated vs auto).
//   5. 'selectedTheme' is saved to localStorage for persistence across reloads.
//   6. A 'themechange' CustomEvent is dispatched on document so the game loop
//      can react (e.g. invalidate the maze cache for a redraw).

const ThemeManager = (() => {
  let _active = null;

  /** Call once at game startup before any rendering begins. */
  function init() {
    const saved = _getSavedThemeId();
    apply(saved || ThemeRegistry.defaultTheme);
  }

  /** Switch the active theme at runtime. Idempotent if same theme. */
  function apply(themeId) {
    const theme = ThemeRegistry.themes[themeId];
    if (!theme) {
      console.warn(`ThemeManager: unknown theme "${themeId}", falling back to default.`);
      apply(ThemeRegistry.defaultTheme);
      return;
    }
    _active = theme;

    // 1. Sync canvas color tokens into the global COLORS / CONFIG.COLORS object
    if (typeof CONFIG !== "undefined" && CONFIG.COLORS) {
      Object.assign(CONFIG.COLORS, theme.colors);
    }

    // 2. Patch the Renderer's internal RENDER_CONFIG.FONTS
    if (typeof Renderer !== "undefined" && Renderer.applyThemeFonts) {
      Renderer.applyThemeFonts(theme.fonts.canvas);
    }

    // 3. Inject CSS custom properties into :root
    _injectCSSVars(theme.cssVars);

    // 4. Apply canvas rendering hints + scanlines class
    _applyRendering(theme.rendering);

    // 5. Persist selection
    try { localStorage.setItem("selectedTheme", themeId); } catch (_) {}

    // 6. Notify any listeners (e.g. game loop can invalidate maze cache)
    document.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  }

  /**
   * Returns an array of { id, label } descriptors for all registered themes,
   * suitable for populating a <select> element.
   */
  function getThemeList() {
    return Object.values(ThemeRegistry.themes).map(({ id, label }) => ({ id, label }));
  }

  // ---- Private helpers ----

  function _injectCSSVars(vars) {
    if (!vars) return;
    const root = document.documentElement;
    for (const [key, val] of Object.entries(vars)) {
      root.style.setProperty(key, val);
    }
  }

  function _applyRendering(r) {
    if (!r) return;
    const canvas = document.getElementById("gameCanvas");
    if (canvas) {
      canvas.style.imageRendering = r.pixelated ? "pixelated" : "auto";
    }
  }

  function _getSavedThemeId() {
    try { return localStorage.getItem("selectedTheme"); } catch (_) { return null; }
  }

  // ---- Public API ----
  return {
    init,
    apply,
    getThemeList,
    get active()    { return _active; },
    get colors()    { return _active ? _active.colors    : null; },
    get fonts()     { return _active ? _active.fonts     : null; },
    get rendering() { return _active ? _active.rendering : null; },
    get sounds()    { return _active ? _active.sounds    : null; },
    get cssVars()   { return _active ? _active.cssVars   : null; },
  };
})();
