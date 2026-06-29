# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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