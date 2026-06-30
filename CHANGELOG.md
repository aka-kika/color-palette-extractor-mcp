# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2026-06-29

### Added
- **Agent skill bundle** at `.skills/color-palette-mcp/`. A ready-to-use SKILL.md (163 lines) plus 3 deep-dive references (full tool reference, brand-vs-ui examples, output folder shape) that other agents (goose, Claude, Codex, etc.) can `load_skill` to immediately know when to use this MCP and which tool to call. The skill is installed at `~/.config/goose/skills/color-palette-mcp/` for goose sessions. Not part of the npm tarball — bundled in the GitHub source for direct cloning.

### Documentation
- README + GUIDE updated through v0.4.0.
- CHANGELOG: new `## [0.4.1]` entry for the skill bundle.

## [0.4.0] - 2026-06-29



### Added
- **`brand_mode` parameter** for `build_palette_folder` — controls whether the source is treated as a brand palette or a UI screenshot. Three values:
  - `"auto"` (default) — heuristic: full-window source + zero wallpaper → brand mode; otherwise UI mode
  - `"brand"` — always treat as brand palette, regardless of source structure
  - `"ui"` — always treat as UI screenshot, regardless of source structure
- **Brand-mode exports** — when `brand_mode` is on, exports are emitted as `brand.{css_vars,scss,tailwind,json,figma}` (the design tokens to ship) plus `demo-inverse.{...}` (a preview of the brand inverted — clearly labelled, *not* a recommended UI theme).
- **Brand-mode HTML guide** — section heading changes from "App theme" to "Brand palette". Banner paragraph explains the demo inverse is for reference only and tells designers to use `brand.*` exports. Tag labels switch from "matches source" / "derived" to "brand" / "demo inverse". Strip titles show "BRAND" and "DEMO INVERSE".
- **Brand-mode README** — prepended with a blockquote explaining the mode, plus the metadata line shows "Brand mode: on" and "Primary theme: brand" instead of "light"/"dark".
- **`autoDetectBrandMode()` helper** — heuristic used by `auto`. Returns true when `window.area >= totalPixels * 0.95` AND `wallpaperCount === 0`. Same-shape function as `detectSourceMode`.
- **`brand_mode` returned in JSON** — `build_palette_folder` response now includes `brand_mode: bool`.
- **Package renamed for npm** — `color-palette-mcp` was already taken on npm, so we publish as `color-palette-extractor-mcp` (still under the same GitHub repo, MIT license). Bin name matches: `color-palette-extractor-mcp`. `package.json` now includes `repository`, `bugs`, `homepage`, `keywords`, `files` allowlist, `engines.node >= 18`, and `prepublishOnly` script.

## [0.3.4] - 2026-06-29

### Fixed
- **Light-mode section titles were too thin** — h2 headings (`App theme`, `LIGHT theme`, `Accessibility`) inherited body color but had no explicit weight, so they rendered at default browser weight (400). On a light-mode page the title text faded into the chrome and looked "bright and not visible". Now h2 has explicit `color: var(--text)` + `font-weight: 600`; theme-block h2 (`<header><h2>${themeLabel} theme</h2>`) gets inline `font-weight: 700`. Both colors are bound to the chrome `--text` variable so dark mode stays bold-but-not-bright.

## [0.3.3] - 2026-06-29

### Fixed
- **Chrome tints derived from brand accent** — `chromePalettes()` previously hardcoded the dark-mode tag pill to `rgba(79,107,206,0.15)` (the original blue accent). The dark page always read as purple/blue even when the brand had no blue at all. Tag pill background and foreground now compute from the brand's extracted accent RGB: `rgba(r,g,b,0.14)` for the bg and a darkened RGB for the fg. For IMG_0396 (brand accent `#857C78` warm grey) the dark tag is now warm-grey instead of blue.
- **Empty Wallpaper section hidden** — when the source image has no separate wallpaper region (e.g. mockup on neutral, full-window brand sheet, photo with no UI), the `wallpaper` array is empty and the "Wallpaper (excluded from app)" section used to render an empty `<div class="palette">` and a broken `<img src="preview-wallpaper.png">`. Now the entire section is omitted from the HTML when `wallpaper.length === 0`.
- **App pair preview swaps with toggle** — `preview-app-pair.png` was a single static PNG, so flipping the LIGHT/DARK toggle didn't change its background tint. Now two variants are generated: `preview-app-pair-light.png` (rendered on a `#f6f7fb` light bg) and `preview-app-pair-dark.png` (rendered on a `#0f1117` dark bg). HTML uses CSS `display: none` keyed to `body.theme-show-*` to swap them. The original `preview-app-pair.png` is kept as a static fallback (light variant) for README/preview contexts that don't render HTML.

## [0.3.2] - 2026-06-29

### Added
- **Themed page chrome** — the HTML design-system guide's surrounding UI (page background, panels, header, footer, table headers, tag pills, toggle) now uses two complementary chrome palettes and switches between them in lockstep with the LIGHT/DARK theme toggle. So flipping the toggle transitions the *whole page* between a light-mode feel (off-white panels, dark text) and a dark-mode feel (deep navy panels, light text) — not just swaps which swatch card is visible.
- **Brand accent in chrome** — the toggle's active-button highlight, plus the `:root` `--accent` variable, are now seeded from the brand's extracted accent hex (not always `#4f6bce`). For the JEZ V image the active toggle button tints dusty pink (`#AF7A79`); for KIKA it tints slate (`#6D80A6`).
- **Chrome palette helper** — `chromePalettes(brandAccentHex)` returns `{light, dark}` records with all UI variables (bg, panel, border, text, muted, tagBg, tagFg, thBg, dot, btnFg). Both records use the same accent so the toggle button highlight stays consistent.
- **Smooth transitions** — body, header, main, swatches, tables, source-info panels, toggle and footer all transition background/border/color over 250ms when the toggle fires.

## [0.3.1] - 2026-06-29

### Fixed
- HTML design-system guide theme toggle was non-functional. The body's initial class was `theme-show-${primaryLabel.toLowerCase()}` ("light" or "dark"), but the CSS selectors and JS toggler used `theme-show-primary` / `theme-show-secondary`. CSS rules never matched, so both themes were always visible and the button highlight didn't track the visibility. Initial body class is now `theme-show-primary`; the active-state class on the button is no longer duplicated (`class="active active"` → `class="active"`).

## [0.3.0] - 2026-06-29

### Added
- **Source mode detection** — `detectSourceMode()` looks at the luminance of the dominant cluster and labels the source `dark` (l < 50%) or `light` (l ≥ 50%). Returned in the JSON response as `source_mode`.
- **`target_mode` parameter** for `build_palette_folder` — controls which theme is labelled primary in the deliverable. Three values:
  - `auto` (default) — primary matches the source's detected mode; secondary is derived as the inverse
  - `dark` — force primary to be the dark theme
  - `light` — force primary to be the light theme
  - Both themes are always produced regardless of `target_mode`.
- **HTML theme toggle** — `index.html` now has a clickable `LIGHT` / `DARK` switch in the header. Both themes are rendered in the page; CSS hides the inactive one. Selection is remembered via `localStorage`. The active button is highlighted in accent color.
- **Symmetric theme derivation** — `deriveOtherMode(swatches, sourceMode)` now branches on `sourceMode` so a light source produces a dark derivation and vice versa (was previously always light).
- **Dynamic file naming** — exports and PNG previews are labelled `app-light.*` or `app-dark.*` based on which theme each represents, not hardcoded to `app-light` being derived.

### Changed
- **`pickDarkRoles` → `pickRolesForMode(swatches, mode)`** — mode-aware role assignment. The `text` role is now the *opposite* extreme of lightness from `background`, not always "lightest".
- **BuildResult** field names changed from `appDark` / `appLight` to `primary` / `secondary`, plus new `sourceMode` field. JSON response key changed from `app_dark` / `app_light` to `primary` / `secondary` plus `source_mode`. This is a breaking change for any consumer that parsed the old keys.
- **HTML header** now shows detected `source_mode` next to the toggle.
- **README** now labels sections as `Primary`/`Secondary` (not `Dark`/`Light`) when the source is light, and shows both themes side-by-side with their a11y tables.

### Tested against
- `IMG_0539.JPG` (KIKA design system, **light theme**) — auto-detect picks `light`, primary = extracted light palette, secondary = derived dark. HTML toggle shows LIGHT active. Slate accent `#7080A5` matches KIKA spec exactly.
- `IMG_0540.JPG` (KIKA design system, **dark theme**) — auto-detect picks `dark`, primary = extracted dark palette, secondary = derived light.
- `55E4D056-7216-4340-AB40-E00046767E9B.JPG` (Vincent's screenshot) — dark app on cream wallpaper. `source_mode: dark`, primary = extracted dark app theme, secondary = derived light theme, wallpaper correctly separated.
- `IMG_0539.JPG` with `target_mode: 'dark'` — primary becomes the derived dark theme (text role inverted), secondary the extracted light. Useful when the source is a light brand sheet but you need dark UI tokens.

## [0.2.1] - 2026-06-29

### Fixed
- HTML design-system guide: text color on light-theme swatch cards was hardcoded to white, making hex labels invisible on near-white backgrounds. Now uses `textOn(hex)` per swatch (same heuristic as PNG previews) so each card picks a contrasting text color.

## [0.2.0] - 2026-06-29

### Added
- Deterministic k-means seeding (`mulberry32`) so re-extracting the same image always produces the same palette. Previously used `Math.random()` and could give slightly different small-cluster assignments between runs.
- Wallpaper role names are now generic (`primary`, `secondary`, `tertiary`, `accent_warm`, `accent_cool`, `highlight`, `shadow`, `ambient`) — work for any wallpaper color family, not just blues.

### Changed
- `pickDarkRoles` now picks **surface** as the lowest-saturation remaining swatch instead of the median lightness. Prevents an accent color from being mis-labeled as the surface tone when the app has no neutral mid-tones.

## [0.1.0] - 2026-06-29

### Added
- **9 MCP tools** exposed over stdio transport:
  - `extract_palette` — k-means / median-cut extraction from an image URL or path. Supports `min_population_ratio` to keep small accent clusters.
  - `extract_app_palette` — auto-detects the app window in a screenshot and returns foreground (app) + background (wallpaper) palettes separately.
  - `build_palette_folder` — end-to-end deliverable generator. One call produces a uniquely-named folder containing previews, exports, README.md, an interactive HTML design-system guide, and a PNG screenshot of the guide.
  - `score_accessibility` — WCAG AA/AAA contrast checks.
  - `suggest_role` — assigns semantic roles (background/text/accent/surface/muted).
  - `export_palette` — outputs in css_vars / scss / tailwind / figma_tokens / json / ase.
  - `harmonize` — generates analogous / triadic / complementary / split / tetradic / monochrome from a seed hex.
  - `match_vibe` — curated palette for a mood/description.
  - `compare_palettes` — ΔE2000 perceptual diff between two palettes.
- **Window detection** module (`src/window.ts`) — row/column density scan of dim-and-desaturated pixels to separate app from wallpaper in screenshots.
- **Per-image deliverable generator** (`src/build.ts`) — folder naming scheme `{stem}_{ISO timestamp}_{8-char sha256}` for uniqueness across re-runs.
- **Light theme derivation** — inverts each dark color's lightness while preserving hue and desaturating for neutral tones; accent kept saturated.
- **HTML design system guide** with cards, contrast tables, and AAA/AA/AA-Large/Fail badges; rendered and screenshotted via headless Chrome for Testing.
- **Resource** `palette://recent` — last 20 palettes extracted in session.
- **Prompts** `design_system_audit` and `a11y_fixer`.
- **GitHub Actions CI** — builds the TypeScript project on push/PR across Node 18, 20, 22.
- MIT license.

### Fixed
- `extractPalette` no longer crashes on 3-channel (RGB) JPEG buffers — auto-detects channel count from buffer length.
- Role assignment surfaces small accents (e.g. status dots, tag colors) when `min_population_ratio: 0` is passed.

### Notes
- All processing is local — images never leave the host.
- Requires Node 18+ and the official `@modelcontextprotocol/sdk` (no wrapper frameworks).
- Headless Chrome screenshot of the HTML guide requires Chrome for Testing at `~/Library/Caches/ms-playwright/...` (installable via `npx playwright install chromium`). Skipped gracefully if not present.

[0.1.0]: https://github.com/aka-kika/color-palette-extractor-mcp/releases/tag/v0.1.0