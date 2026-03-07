// ===========================================
// Theme Registry
// ===========================================
// To add a new theme:
//   1. Create src/themes/your-theme.js following the same shape as retro-neon.js
//   2. Add a <script src="themes/your-theme.js"> in index.html BEFORE this script
//   3. Add the theme variable to the `themes` object below — that's all.
//
// Zero changes to renderer.js, game.js, or any other engine file are needed.

const ThemeRegistry = {
  themes: {
    [retroNeonTheme.id]:   retroNeonTheme,
    [midnightVoidTheme.id]: midnightVoidTheme,
    [sandstormTheme.id]:    sandstormTheme,
    [cyberSakuraTheme.id]:  cyberSakuraTheme,
  },
  defaultTheme: "retro-neon",
};
