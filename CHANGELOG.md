# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/aka-kika/color-palette-mcp/releases/tag/v0.1.0