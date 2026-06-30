// Build a complete deliverable folder per image: previews, exports, README.md,
// index.html design system guide, and a PNG screenshot of the guide.
// Includes window detection so app + wallpaper palettes are separated.
import sharp from "sharp";
import { extractPalette } from "./extract.js";
import { splitForegroundBackground } from "./window.js";
import {
  hexToRgb, rgbToHsl, hslToRgb, rgbToHex, contrastRatio, wcagLevel,
} from "./color.js";
import { comparePalettes } from "./compare.js";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";

const ROOT = process.env.PALETTE_OUTPUT_DIR || "/Users/gamba/Documents/gooooose/color-palette-mcp/output";
const CHROME_PATHS = [
  "/Users/gamba/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

async function findChrome(): Promise<string | null> {
  for (const p of CHROME_PATHS) {
    try { await fs.access(p); return p; } catch {}
  }
  return null;
}

function textOn(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  return y > 140 ? "#0f1117" : "#f7f7f8";
}

async function renderTile(swatch: any, size: number): Promise<Buffer> {
  const label = (swatch.role || "").toUpperCase();
  const popText = swatch.population != null ? `${swatch.population.toLocaleString()} px` : "";
  const fg = textOn(swatch.hex);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${swatch.hex}"/>
    <rect x="0" y="0" width="${size}" height="${Math.round(size / 3)}" fill="${fg}" fill-opacity="0.10"/>
    <text x="14" y="28" font-family="-apple-system, system-ui, sans-serif" font-size="13" font-weight="700" fill="${fg}" letter-spacing="1">${label}</text>
    <text x="14" y="${size - 38}" font-family="-apple-system, system-ui, sans-serif" font-size="22" font-weight="700" fill="${fg}">${swatch.hex.toUpperCase()}</text>
    <text x="14" y="${size - 16}" font-family="-apple-system, system-ui, sans-serif" font-size="11" fill="${fg}" opacity="0.85">${popText}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function renderStrip(swatches: any[], opts: any): Promise<Buffer> {
  const { tileSize = 200, gap = 14, cols, title = "", bg = "#0f1117" } = opts;
  const n = swatches.length;
  const c = cols ?? Math.min(n, 6);
  const rows = Math.ceil(n / c);
  const stripW = c * tileSize + (c - 1) * gap;
  const titleH = title ? 50 : 0;
  const stripH = titleH + rows * tileSize + (rows - 1) * gap + 20;

  const comps: any[] = [];
  if (title) {
    const titleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${stripW}" height="${titleH}">
      <rect width="${stripW}" height="${titleH}" fill="${bg}"/>
      <text x="20" y="32" font-family="-apple-system, system-ui, sans-serif" font-size="20" font-weight="700" fill="#ffffff">${title}</text>
    </svg>`;
    comps.push({ input: Buffer.from(titleSvg), top: 0, left: 0 });
  }

  for (let i = 0; i < n; i++) {
    const col = i % c, row = Math.floor(i / c);
    const x = col * (tileSize + gap);
    const y = titleH + row * (tileSize + gap);
    const buf = await renderTile(swatches[i], tileSize);
    comps.push({ input: buf, top: y, left: x });
  }

  const baseSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${stripW}" height="${stripH}">
    <rect width="${stripW}" height="${stripH}" fill="${bg}"/>
  </svg>`;
  return sharp(Buffer.from(baseSvg)).composite(comps).png().toBuffer();
}

async function renderThemePair(first: any[], second: any[], opts: any): Promise<Buffer> {
  // firstLabel/secondLabel render above each row of tiles. Defaults to DARK/LIGHT.
  const { tileSize = 200, gap = 14, title = "", bg = "#0f1117",
          firstLabel = "DARK", secondLabel = "LIGHT" } = opts;
  const n = first.length;
  const w = n * tileSize + (n - 1) * gap;
  const labelH = 40;
  const titleH = title ? 50 : 0;
  const blockH = tileSize + labelH + gap;
  const h = titleH + blockH * 2 + 20;

  const comps: any[] = [];
  if (title) {
    const titleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${titleH}">
      <rect width="${w}" height="${titleH}" fill="${bg}"/>
      <text x="20" y="32" font-family="-apple-system, system-ui, sans-serif" font-size="20" font-weight="700" fill="#ffffff">${title}</text>
    </svg>`;
    comps.push({ input: Buffer.from(titleSvg), top: 0, left: 0 });
  }

  const firstLabelSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${labelH}">
    <text x="20" y="28" font-family="-apple-system, system-ui, sans-serif" font-size="14" font-weight="700" fill="#cccccc" letter-spacing="2">${firstLabel}</text>
  </svg>`);
  comps.push({ input: firstLabelSvg, top: titleH, left: 0 });
  for (let i = 0; i < n; i++) {
    const buf = await renderTile(first[i], tileSize);
    comps.push({ input: buf, top: titleH + labelH, left: i * (tileSize + gap) });
  }

  const secondLabelSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${labelH}">
    <text x="20" y="28" font-family="-apple-system, system-ui, sans-serif" font-size="14" font-weight="700" fill="#cccccc" letter-spacing="2">${secondLabel}</text>
  </svg>`);
  comps.push({ input: secondLabelSvg, top: titleH + blockH, left: 0 });
  for (let i = 0; i < n; i++) {
    const buf = await renderTile(second[i], tileSize);
    comps.push({ input: buf, top: titleH + blockH + labelH, left: i * (tileSize + gap) });
  }

  const baseSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${bg}"/>
  </svg>`;
  return sharp(Buffer.from(baseSvg)).composite(comps).png().toBuffer();
}

// --- role assignment ---
// Pick roles given an explicit source mode ("dark" or "light"). This is the
// authoritative role-assignment logic — both themes flow through here.
function pickRolesForMode(swatches: any[], sourceMode: "dark" | "light"): any[] {
  const sorted = [...swatches].sort((a, b) => b.population - a.population);
  const bg = sorted[0];

  // Text = the extreme of lightness opposite to the background.
  //   dark source  → text = lightest
  //   light source → text = darkest
  const targetL = sourceMode === "dark" ? Infinity : -Infinity;
  const text = [...swatches].sort((a, b) =>
    sourceMode === "dark" ? b.hsl.l - a.hsl.l : a.hsl.l - b.hsl.l
  )[0];

  // Accent = highest saturation among the remaining clusters.
  const remaining = swatches.filter((s) => s.hex !== bg.hex && s.hex !== text.hex);
  const accent = [...remaining].sort((a, b) => b.hsl.s - a.hsl.s)[0] || text;

  // Surface = lowest saturation among remaining (most neutral mid-tone).
  // Falls back to bg if every remaining swatch is highly saturated.
  const surface = remaining
    .filter((s) => s.hex !== accent.hex)
    .sort((a, b) => a.hsl.s - b.hsl.s)[0] || bg;

  return [
    { ...bg, role: "background" },
    { ...surface, role: "surface" },
    { ...text, role: "text" },
    { ...accent, role: "accent" },
  ];
}

// Derive the opposite theme by inverting lightness while preserving hue.
// `sourceMode` is the mode of the input palette, so the output is its inverse:
//   source "dark"  → output "light"
//   source "light" → output "dark"
function deriveOtherMode(swatches: any[], sourceMode: "dark" | "light"): any[] {
  const invert = sourceMode === "dark"; // dark→light maps light-l targets; light→dark maps dark-l targets
  return swatches.map((s) => {
    const hsl = s.hsl;
    let targetL: number, targetS: number;
    if (invert) {
      // Dark source → produce a light theme
      switch (s.role) {
        case "background": targetL = 97; targetS = 0.15; break;
        case "surface":    targetL = 92; targetS = 0.25; break;
        case "text":       targetL = 16; targetS = 0.15; break;
        case "accent":     targetL = 48; targetS = 0.85; break;
        default:           targetL = 50; targetS = 0.50;
      }
    } else {
      // Light source → produce a dark theme
      switch (s.role) {
        case "background": targetL = 8;  targetS = 0.15; break;
        case "surface":    targetL = 18; targetS = 0.25; break;
        case "text":       targetL = 96; targetS = 0.15; break;
        case "accent":     targetL = 52; targetS = 0.85; break;
        default:           targetL = 50; targetS = 0.50;
      }
    }
    const newHex = rgbToHex(hslToRgb({
      h: hsl.h, s: Math.min(50, hsl.s * targetS), l: targetL,
    }));
    return {
      hex: newHex, rgb: hexToRgb(newHex), hsl: rgbToHsl(hexToRgb(newHex)),
      population: s.population, role: s.role,
    };
  });
}

// Detect whether the source palette is a dark or light theme by the luminance
// of the dominant cluster. Threshold at 50% — empirically matches perception.
function detectSourceMode(swatches: any[]): "dark" | "light" {
  if (swatches.length === 0) return "dark";
  const sorted = [...swatches].sort((a, b) => b.population - a.population);
  const bgL = sorted[0].hsl.l;
  return bgL < 50 ? "dark" : "light";
}

// Reorganize an extracted palette according to an explicit target mode.
// When target === "auto", roles are picked based on the detected source mode,
// and the source palette is also rendered as one of the two output themes.
function arrangeThemes(
  raw: any[],
  targetMode: "auto" | "dark" | "light",
): { sourceMode: "dark" | "light"; primary: any[]; secondary: any[] } {
  const sourceMode = detectSourceMode(raw);
  const resolvedTarget: "dark" | "light" = targetMode === "auto" ? sourceMode : targetMode;

  // The "primary" theme uses roles picked for the actual source (or for the
  // requested target). The "secondary" theme is derived as the inverse.
  // When sourceMode === resolvedTarget, primary = source + roles, secondary = derived.
  // When they differ (e.g. user has dark theme but asks for light), primary is
  // still the source-derived palette, secondary is the opposite derivation.
  const primary = pickRolesForMode(raw, resolvedTarget);
  const secondary = deriveOtherMode(primary, sourceMode);
  return { sourceMode, primary, secondary };
}

// Names are ordered most-saturated first. The colors dominate so for monochrome/cream
// wallpapers most roles will be small accents; for chromatic wallpapers each role
// tends to get a distinct hue family.
const WALLPAPER_ROLE_NAMES = [
  "primary",     // highest saturation
  "secondary",   // next
  "tertiary",
  "accent_warm",     // warm-shifted (if present)
  "accent_cool",     // cool-shifted (if present)
  "highlight",
  "shadow",
  "ambient",     // lowest saturation, usually the dominant base
];

function pickWallpaperRoles(swatches: any[]): any[] {
  const sorted = [...swatches].sort((a, b) => b.hsl.s - a.hsl.s);
  return sorted.slice(0, 8).map((s, i) => ({
    ...s, role: WALLPAPER_ROLE_NAMES[i] || `accent_${i + 1}`,
  }));
}

// --- exporters ---
function asSwatch(s: any) { return { hex: s.hex, rgb: s.rgb, hsl: s.hsl, population: s.population, role: s.role }; }
function cssVars(swatches: any[], name: string): string {
  let out = `/* ${name} */\n:root {\n`;
  for (const s of swatches) out += `  --${name}-${s.role}: ${s.hex};\n`;
  out += "}\n";
  return out;
}
function tailwind(swatches: any[], name: string): string {
  let out = `// tailwind.config — ${name}\nmodule.exports = {\n  theme: { extend: { colors: {\n`;
  for (const s of swatches) out += `    '${name}-${s.role}': '${s.hex}',\n`;
  out += "  } } }\n};\n";
  return out;
}
function figmaTokens(swatches: any[], name: string): string {
  const obj: Record<string, any> = {};
  for (const s of swatches) obj[s.role] = { value: s.hex, type: "color" };
  return JSON.stringify({ [name]: obj }, null, 2);
}
function jsonOut(swatches: any[], name: string): string {
  return JSON.stringify({ name, colors: swatches.map(asSwatch) }, null, 2);
}
function scss(swatches: any[], name: string): string {
  let out = `// ${name}\n`;
  for (const s of swatches) out += `$${name}-${s.role}: ${s.hex};\n`;
  return out;
}

/**
 * Compute a UI chrome palette for the HTML guide that complements the brand.
 * Two palettes: a "light page" feel (off-white panels, dark text) and a "dark
 * page" feel (deep panels, light text). Both share the brand's accent color
 * so the toggle UI matches the palette the user is inspecting. Tag pills,
 * table dividers, and dot borders are derived from the accent at varying
 * opacities so the chrome reads as "tinted by" the brand, not as a fixed
 * blue/purple overlay.
 */
function chromePalettes(brandAccentHex: string) {
  const accent = brandAccentHex || "#4f6bce";
  const a = hexToRgb(accent);
  // Tag pill: tint with the brand accent at ~12% opacity so the chrome reads
  // as a continuation of the palette, not a different color.
  const tagBg = a ? `rgba(${a.r},${a.g},${a.b},0.14)` : "rgba(79,107,206,0.15)";
  const tagFg = a ? `rgb(${Math.min(255,Math.round(a.r*0.55 + 110))},${Math.min(255,Math.round(a.g*0.55 + 110))},${Math.min(255,Math.round(a.b*0.55 + 110))})` : "#9fb0e8";
  return {
    light: {
      bg: "#f6f7fb", panel: "#ffffff", border: "#e3e6ee",
      text: "#1a1d27", muted: "#6c7286", accent,
      tagBg: a ? `rgba(${a.r},${a.g},${a.b},0.10)` : "rgba(0,0,0,0.06)",
      tagFg: a ? `rgb(${Math.max(0,Math.round(a.r*0.45 + 50))},${Math.max(0,Math.round(a.g*0.45 + 50))},${Math.max(0,Math.round(a.b*0.45 + 50))})` : "#3d4b8a",
      thBg: "rgba(0,0,0,0.03)", dot: "rgba(0,0,0,0.10)",
      btnFg: "#ffffff",
    },
    dark: {
      bg: "#0f1117", panel: "#1c2030", border: "#2a2f42",
      text: "#e8e9ee", muted: "#8a92a8", accent,
      tagBg, tagFg,
      thBg: "rgba(255,255,255,0.03)", dot: "rgba(255,255,255,0.10)",
      btnFg: "#ffffff",
    },
  };
}

function htmlGuide(opts: any): string {
  const { title, src, window: win, primary, secondary, wallpaper, a11y, primaryLabel, secondaryLabel, sourceMode } = opts;
  const brandAccent = (primary.find((s: any) => s.role === "accent") || {}).hex || "#4f6bce";
  const chrome = chromePalettes(brandAccent);
  const renderCard = (s: any) => {
    // Pick a readable text color for this swatch's chip — same heuristic the PNG previews use.
    const fg = textOn(s.hex);
    return `
    <div class="swatch">
      <div class="chip" style="background:${s.hex}; color:${fg}">
        <span class="role">${s.role}</span>
        <span class="hex">${s.hex.toUpperCase()}</span>
        <span class="pop">${s.population ? s.population.toLocaleString() + " px" : ""}</span>
      </div>
      <div class="meta">
        <div><span class="k">RGB</span> <span class="v">${Math.round(s.rgb.r)}, ${Math.round(s.rgb.g)}, ${Math.round(s.rgb.b)}</span></div>
        <div><span class="k">HSL</span> <span class="v">${Math.round(s.hsl.h)}°, ${Math.round(s.hsl.s)}%, ${Math.round(s.hsl.l)}%</span></div>
      </div>
    </div>
    `;
  };

  const renderThemeBlock = (themeLabel: string, swatches: any[], id: string) => {
    const bg = swatches.find((s: any) => s.role === "background");
    const bgHex = bg.hex;
    const rows = swatches.map((s: any) => {
      const onBg = contrastRatio(hexToRgb(s.hex), hexToRgb(bgHex));
      return `
        <tr>
          <td><div class="dot" style="background:${s.hex}"></div></td>
          <td><code>${s.hex.toUpperCase()}</code></td>
          <td><code>${s.role}</code></td>
          <td>${Math.round(s.hsl.h)}, ${Math.round(s.hsl.s)}, ${Math.round(s.hsl.l)}</td>
          <td>${onBg.toFixed(2)} <small>(${wcagLevel(onBg)})</small></td>
        </tr>`;
    }).join("");
    const sourceLabel = themeLabel === primaryLabel ? "matches source" : "derived";
    return `
      <section class="theme theme-${id}" data-theme="${themeLabel.toLowerCase()}">
        <header style="color: var(--text);"><h2 style="color: var(--text); font-weight: 700;">${themeLabel} theme</h2><span class="tag">${sourceLabel}</span></header>
        <div class="palette">${swatches.map(renderCard).join("")}</div>
        <table>
          <thead><tr><th></th><th>Hex</th><th>Role</th><th>HSL</th><th>Contrast on ${bgHex.toUpperCase()}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
  };

  const a11yRows = a11y.map((r: any) => `
    <tr>
      <td>${r.label}</td>
      <td><div class="dot" style="background:${r.fg}"></div> <code>${r.fg.toUpperCase()}</code></td>
      <td><div class="dot" style="background:${r.bg}"></div> <code>${r.bg.toUpperCase()}</code></td>
      <td><strong>${r.ratio.toFixed(2)}</strong></td>
      <td><span class="badge badge-${r.level.toLowerCase().replace(/[^a-z]/g, "")}">${r.level}</span></td>
    </tr>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Design System</title>
<style>
  /* Two chrome palettes — applied by JS depending on body.theme-show-* class.
     This way the page chrome follows the toggle: light chrome when showing
     the light theme, dark chrome when showing the dark theme. The accent
     always comes from the brand palette. */
  :root { --accent: ${chrome.dark.accent}; }
  body.theme-show-primary {
    --bg: ${chrome.light.bg}; --panel: ${chrome.light.panel}; --border: ${chrome.light.border};
    --text: ${chrome.light.text}; --muted: ${chrome.light.muted};
    --tagBg: ${chrome.light.tagBg}; --tagFg: ${chrome.light.tagFg};
    --thBg: ${chrome.light.thBg}; --dot: ${chrome.light.dot}; --btnFg: ${chrome.light.btnFg};
  }
  body.theme-show-secondary {
    --bg: ${chrome.dark.bg}; --panel: ${chrome.dark.panel}; --border: ${chrome.dark.border};
    --text: ${chrome.dark.text}; --muted: ${chrome.dark.muted};
    --tagBg: ${chrome.dark.tagBg}; --tagFg: ${chrome.dark.tagFg};
    --thBg: ${chrome.dark.thBg}; --dot: ${chrome.dark.dot}; --btnFg: ${chrome.dark.btnFg};
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 -apple-system, system-ui, "SF Pro Text", sans-serif; background: var(--bg); color: var(--text); transition: background-color 0.25s ease, color 0.25s ease; }
  header, main, .swatch, table, .src-info, .theme-toggle, footer { transition: background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease; }
  header { padding: 32px 40px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  header h1 { margin: 0; font-size: 22px; color: var(--text); }
  header .meta { color: var(--muted); font-size: 13px; }
  main { max-width: 1100px; margin: 0 auto; padding: 32px 40px 80px; }
  section { margin-bottom: 56px; }
  h2 { font-size: 18px; margin: 0 0 20px; letter-spacing: 0.5px; color: var(--text); font-weight: 600; }
  .palette { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .swatch { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .chip { aspect-ratio: 4/3; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; }
  .chip .role { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; opacity: 0.8; }
  .chip .hex { font: 700 18px/1 ui-monospace, "SF Mono", monospace; }
  .chip .pop { font-size: 11px; opacity: 0.7; }
  .meta { padding: 10px 14px; font-size: 12px; color: var(--muted); }
  .meta div { display: flex; justify-content: space-between; }
  .meta .k { color: var(--muted); }
  .meta .v { color: var(--text); font-family: ui-monospace, monospace; }
  table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); }
  tr:last-child td { border-bottom: none; }
  th { background: var(--thBg); font-size: 12px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
  code { font-family: ui-monospace, "SF Mono", monospace; font-size: 13px; }
  .dot { width: 14px; height: 14px; border-radius: 4px; display: inline-block; vertical-align: middle; border: 1px solid var(--dot); margin-right: 8px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
  .badge-aaa { background: #1e6b3a; color: #d4f5dd; }
  .badge-aa { background: #4f6bce; color: #e0e7ff; }
  .badge-aalarge { background: #2d3f6b; color: #c8d4f0; }
  .badge-fail { background: #5a1f25; color: #f5c8cc; }
  .preview-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .preview-row img { width: 100%; border-radius: 10px; border: 1px solid var(--border); }
  .src-info { background: var(--panel); padding: 16px 20px; border-radius: 10px; border: 1px solid var(--border); display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .src-info div span { display: block; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
  .src-info div strong { font-size: 16px; }
  footer { padding: 20px 40px; border-top: 1px solid var(--border); color: var(--muted); font-size: 12px; text-align: center; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; background: var(--tagBg); color: var(--tagFg); margin-left: 8px; vertical-align: middle; }

  /* Theme toggle */
  .theme-toggle { display: inline-flex; background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 3px; gap: 2px; }
  .theme-toggle button { background: transparent; border: none; padding: 6px 14px; font: 600 11px/1 ui-monospace, monospace; letter-spacing: 1px; color: var(--muted); cursor: pointer; border-radius: 4px; transition: background 0.15s ease, color 0.15s ease; }
  .theme-toggle button.active { background: var(--accent); color: var(--btnFg); }
  .theme-toggle button:hover:not(.active) { color: var(--text); }

  /* Theme visibility — both are rendered, hidden via display:none when not active */
  body.theme-show-primary .theme-secondary { display: none; }
  body.theme-show-secondary .theme-primary { display: none; }

  /* Theme-aware pair preview — show the light/dark variant matching the page chrome. */
  .pair-preview { position: relative; }
  .pair-preview img { width: 100%; border-radius: 10px; border: 1px solid var(--border); display: block; }
  body.theme-show-primary .pair-preview .pair-dark  { display: none; }
  body.theme-show-secondary .pair-preview .pair-light { display: none; }

  /* Hide the wallpaper section entirely when there are no wallpaper colors
     (empty palette, broken image). Skips the section header + empty div. */
  section.wallpaper-section { display: none; }
</style>
</head>
<body class="theme-show-primary">
<header>
  <h1>${title}</h1>
  <div style="display:flex; gap:24px; align-items:center;">
    <div class="meta">source: <code>${sourceMode}</code> · generated by color-palette-mcp</div>
    <div class="theme-toggle" role="tablist" aria-label="Theme">
      <button type="button" data-set-theme="primary" class="active">${primaryLabel}</button>
      <button type="button" data-set-theme="secondary">${secondaryLabel}</button>
    </div>
  </div>
</header>
<main>
  <section>
    <h2>Source</h2>
    <div class="src-info">
      <div><span>Source</span><strong><code>${src}</code></strong></div>
      <div><span>Window</span><strong>${win.width}×${win.height} @ (${win.x},${win.y})</strong></div>
      <div><span>App colors</span><strong>${primary.length}</strong></div>
      <div><span>Wallpaper colors</span><strong>${wallpaper.length}</strong></div>
    </div>
    <div class="preview-row" style="margin-top:16px">
      <img src="app-window-cropped.png" alt="Detected app window">
      <div class="pair-preview">
        <img class="pair-light" src="preview-app-pair-light.png" alt="Theme comparison (light)">
        <img class="pair-dark"  src="preview-app-pair-dark.png"  alt="Theme comparison (dark)">
      </div>
    </div>
  </section>
  <section>
    <h2>App theme</h2>
    ${renderThemeBlock(primaryLabel, primary, "primary")}
    ${renderThemeBlock(secondaryLabel, secondary, "secondary")}
  </section>
  <section>
    <h2>Accessibility</h2>
    <table>
      <thead><tr><th>Pair</th><th>Foreground</th><th>Background</th><th>Ratio</th><th>Level</th></tr></thead>
      <tbody>${a11yRows}</tbody>
    </table>
  </section>
  ${wallpaper.length > 0 ? `<section class="wallpaper-section">
    <h2>Wallpaper (excluded from app)</h2>
    <div class="palette">${wallpaper.map(renderCard).join("")}</div>
    <img src="preview-wallpaper.png" alt="Wallpaper palette" style="width:100%;border-radius:10px;border:1px solid var(--border)">
  </section>` : ""}
</main>
<footer>Color Palette MCP · ${new Date().toISOString().split("T")[0]}</footer>
<script>
  (function() {
    var body = document.body;
    var buttons = document.querySelectorAll('[data-set-theme]');
    function set(which) {
      body.classList.remove('theme-show-primary', 'theme-show-secondary');
      body.classList.add('theme-show-' + which);
      buttons.forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-set-theme') === which);
      });
      try { localStorage.setItem('paletteTheme', which); } catch (e) {}
    }
    buttons.forEach(function(b) {
      b.addEventListener('click', function() {
        set(b.getAttribute('data-set-theme'));
      });
    });
    try {
      var saved = localStorage.getItem('paletteTheme');
      if (saved === 'primary' || saved === 'secondary') set(saved);
    } catch (e) {}
  })();
</script>
</body>
</html>`;
}

export type BuildResult = {
  folder: string;
  hash: string;
  window: { x: number; y: number; width: number; height: number };
  sourceMode: "dark" | "light";
  primary: any[];   // the palette matching the source (or requested target)
  secondary: any[]; // the inverse theme, derived from primary
  wallpaper: any[];
  a11y: any[];
  comparison: { meanDeltaE: number; meanSimilarity: number };
  files: string[];
};

/**
 * Build a complete deliverable folder for an image: previews, exports, README,
 * HTML design system guide, and PNG screenshot of the guide. Folder name is
 * `{stem}_{timestamp}_{hash}` where stem comes from the source filename.
 *
 * `targetMode` controls how the two output themes are labelled:
 *   - `"auto"` (default) — detect dark/light from the source palette and emit
 *     one as primary, the inverse as secondary
 *   - `"dark"` — force primary to be the dark theme
 *   - `"light"` — force primary to be the light theme
 *
 * Both themes are always produced regardless of targetMode.
 */
export async function buildDeliverableFolder(
  src: string,
  opts: { outputDir?: string; targetMode?: "auto" | "dark" | "light" } = {},
): Promise<BuildResult> {
  const outDir = opts.outputDir || ROOT;
  const targetMode = opts.targetMode || "auto";
  const fileBuf = await fs.readFile(src);
  const hash = createHash("sha256").update(fileBuf).digest("hex").slice(0, 8);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T").join("_").slice(0, 19);
  const stem = src.split("/").pop()!.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const folderName = `${stem}_${timestamp}_${hash}`;
  const OUT = `${outDir}/${folderName}`;
  await fs.mkdir(OUT, { recursive: true });

  const ext = src.split(".").pop()!;
  await fs.copyFile(src, `${OUT}/source.${ext}`);

  const { data, info } = await sharp(src)
    .resize({ width: 600, height: 600, fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const split = splitForegroundBackground(data, info.width, info.height, info.channels);

  await sharp(split.foregroundPixels, {
    raw: { width: split.foreground.width, height: split.foreground.height, channels: info.channels },
  }).png().toFile(`${OUT}/app-window-cropped.png`);

  const fgRaw = extractPalette(split.foregroundPixels, split.foreground.width, split.foreground.height, { count: 12, method: "kmeans", minPopulationRatio: 0 });
  const bgRaw = split.backgroundCount > 0
    ? extractPalette(split.backgroundPixels, split.backgroundCount, 1, { count: 12, method: "kmeans", minPopulationRatio: 0 })
    : [];

  const { sourceMode, primary, secondary } = arrangeThemes(fgRaw, targetMode);
  const wallpaper = pickWallpaperRoles(bgRaw);

  const a11y: any[] = [];
  for (const theme of [
    { label: "Primary", sw: primary },
    { label: "Secondary", sw: secondary },
  ]) {
    const bg = theme.sw.find((s: any) => s.role === "background");
    for (const fg of theme.sw) {
      if (fg.role === "background") continue;
      const ratio = contrastRatio(hexToRgb(fg.hex), hexToRgb(bg.hex));
      a11y.push({ label: `${theme.label} — ${fg.role} on background`, fg: fg.hex, bg: bg.hex, ratio, level: wcagLevel(ratio) });
    }
  }

  const cmp = comparePalettes(secondary.map((s) => s.hex), primary.map((s) => s.hex));

  const primaryLabel = primary[0].hsl.l < 50 ? "DARK" : "LIGHT";
  const secondaryLabel = secondary[0].hsl.l < 50 ? "DARK" : "LIGHT";
  const primarySlug = `app-${primaryLabel.toLowerCase()}`;
  const secondarySlug = `app-${secondaryLabel.toLowerCase()}`;

  await fs.writeFile(`${OUT}/preview-${primarySlug}.png`,
    await renderStrip(primary, { title: `APP ${primaryLabel}`, tileSize: 200, cols: 4 }));
  await fs.writeFile(`${OUT}/preview-${secondarySlug}.png`,
    await renderStrip(secondary, { title: `APP ${secondaryLabel}`, tileSize: 200, cols: 4 }));
  await fs.writeFile(`${OUT}/preview-wallpaper.png`, await renderStrip(wallpaper, { title: "WALLPAPER", tileSize: 200, cols: 4 }));
  // Two pair previews so the HTML toggle can swap them. Each preview has a
  // matching background tint (light or dark) so the swatch row above each
  // pair reads correctly against the page chrome in either mode.
  await fs.writeFile(`${OUT}/preview-app-pair-light.png`,
    await renderThemePair(primary, secondary, {
      title: `APP THEME — ${primaryLabel.toLowerCase()} vs ${secondaryLabel.toLowerCase()}`,
      firstLabel: primaryLabel, secondLabel: secondaryLabel, tileSize: 200, bg: "#f6f7fb",
    }));
  await fs.writeFile(`${OUT}/preview-app-pair-dark.png`,
    await renderThemePair(primary, secondary, {
      title: `APP THEME — ${primaryLabel.toLowerCase()} vs ${secondaryLabel.toLowerCase()}`,
      firstLabel: primaryLabel, secondLabel: secondaryLabel, tileSize: 200, bg: "#0f1117",
    }));
  // Static fallback (default to the light variant).
  await fs.writeFile(`${OUT}/preview-app-pair.png`,
    await renderThemePair(primary, secondary, {
      title: `APP THEME — ${primaryLabel.toLowerCase()} vs ${secondaryLabel.toLowerCase()}`,
      firstLabel: primaryLabel, secondLabel: secondaryLabel, tileSize: 200, bg: "#f6f7fb",
    }));
  await fs.writeFile(`${OUT}/preview-all.png`,
    await renderStrip([...primary, ...wallpaper], { title: "FULL — app + wallpaper", tileSize: 160, cols: 6 }));

  await fs.mkdir(`${OUT}/exports`, { recursive: true });
  const exportFiles: Record<string, string> = {
    [`exports/${primarySlug}.css_vars`]:   cssVars(primary, primarySlug),
    [`exports/${primarySlug}.tailwind`]:   tailwind(primary, primarySlug),
    [`exports/${primarySlug}.scss`]:       scss(primary, primarySlug),
    [`exports/${primarySlug}.json`]:       jsonOut(primary, primarySlug),
    [`exports/${primarySlug}.figma`]:      figmaTokens(primary, primarySlug),
    [`exports/${secondarySlug}.css_vars`]: cssVars(secondary, secondarySlug),
    [`exports/${secondarySlug}.tailwind`]: tailwind(secondary, secondarySlug),
    [`exports/${secondarySlug}.scss`]:     scss(secondary, secondarySlug),
    [`exports/${secondarySlug}.json`]:     jsonOut(secondary, secondarySlug),
    [`exports/${secondarySlug}.figma`]:    figmaTokens(secondary, secondarySlug),
    "exports/wallpaper.css_vars": cssVars(wallpaper, "wallpaper"),
    "exports/wallpaper.tailwind": tailwind(wallpaper, "wallpaper"),
    "exports/wallpaper.scss":     scss(wallpaper, "wallpaper"),
    "exports/wallpaper.json":     jsonOut(wallpaper, "wallpaper"),
    "exports/wallpaper.figma":    figmaTokens(wallpaper, "wallpaper"),
  };
  for (const [name, content] of Object.entries(exportFiles)) {
    await fs.writeFile(`${OUT}/${name}`, content);
  }

  const html = htmlGuide({
    title: stem, src: src.split("/").pop(),
    window: split.foreground, primary, secondary, wallpaper, a11y,
    primaryLabel, secondaryLabel, sourceMode,
  });
  await fs.writeFile(`${OUT}/index.html`, html);

  // Screenshot the HTML guide
  const chrome = await findChrome();
  if (chrome) {
    try {
      const out = `${OUT}/index.png`;
      execSync(`"${chrome}" --headless=new --no-sandbox --disable-gpu --hide-scrollbars --window-size=1200,1600 --screenshot="${out}" "file://${OUT}/index.html" 2>/dev/null`, { timeout: 30000 });
    } catch {}
  }

  // README.md
  const md = `# ${stem}

Generated by **color-palette-mcp** on ${new Date().toISOString().split("T")[0]}.

**Source mode:** \`${sourceMode}\` · **Primary theme:** \`${primaryLabel.toLowerCase()}\` · **Secondary theme:** \`${secondaryLabel.toLowerCase()}\`

## Source
- **File:** \`${src.split("/").pop()}\`
- **Detected window:** ${split.foreground.width}×${split.foreground.height} at (${split.foreground.x}, ${split.foreground.y})
- **Hash:** \`${hash}\`

## App palette (extracted from window)

### ${primaryLabel} theme (primary)
| Role | Hex | RGB | HSL | Population |
|---|---|---|---|---|
${primary.map((s: any) => `| ${s.role} | \`${s.hex.toUpperCase()}\` | ${Math.round(s.rgb.r)}, ${Math.round(s.rgb.g)}, ${Math.round(s.rgb.b)} | ${Math.round(s.hsl.h)}°, ${Math.round(s.hsl.s)}%, ${Math.round(s.hsl.l)}% | ${s.population.toLocaleString()} px |`).join("\n")}

### ${secondaryLabel} theme (derived)
| Role | Hex | RGB | HSL |
|---|---|---|---|
${secondary.map((s: any) => `| ${s.role} | \`${s.hex.toUpperCase()}\` | ${Math.round(s.rgb.r)}, ${Math.round(s.rgb.g)}, ${Math.round(s.rgb.b)} | ${Math.round(s.hsl.h)}°, ${Math.round(s.hsl.s)}%, ${Math.round(s.hsl.l)}% |`).join("\n")}

### ${primaryLabel} vs ${secondaryLabel} ΔE
- Mean ΔE2000: **${cmp.meanDeltaE}**
- Mean similarity: **${cmp.meanSimilarity}**

## Wallpaper (excluded from app)
| Role | Hex | Population |
|---|---|---|
${wallpaper.map((s: any) => `| ${s.role} | \`${s.hex.toUpperCase()}\` | ${s.population.toLocaleString()} px |`).join("\n")}

## Accessibility
| Pair | FG | BG | Ratio | Level |
|---|---|---|---|---|
${a11y.map((r: any) => `| ${r.label} | \`${r.fg.toUpperCase()}\` | \`${r.bg.toUpperCase()}\` | ${r.ratio.toFixed(2)} | ${r.level} |`).join("\n")}

## Files
- \`source.${ext}\` — original image
- \`app-window-cropped.png\` — detected app window
- \`preview-${primarySlug}.png\`, \`preview-${secondarySlug}.png\`, \`preview-wallpaper.png\` — palette previews
- \`preview-app-pair.png\` — ${primaryLabel.toLowerCase()} vs ${secondaryLabel.toLowerCase()} comparison
- \`preview-all.png\` — combined view
- \`index.html\` — interactive design system guide (with dark/light toggle)
- \`index.png\` — screenshot of the design system guide
- \`exports/\` — palette in css_vars, scss, tailwind, json, figma_tokens formats

## Preview
![App ${primaryLabel.toLowerCase()}](preview-${primarySlug}.png)

![App pair](preview-app-pair.png)

![Wallpaper](preview-wallpaper.png)

![Design system guide](index.png)
`;
  await fs.writeFile(`${OUT}/README.md`, md);

  const allFiles: string[] = [];
  async function walk(d: string, prefix: string) {
    for (const f of await fs.readdir(d)) {
      const p = `${d}/${f}`;
      const stat = await fs.stat(p);
      if (stat.isDirectory()) await walk(p, `${prefix}${f}/`);
      else allFiles.push(`${prefix}${f}`);
    }
  }
  await walk(OUT, "");

  return {
    folder: OUT,
    hash,
    window: split.foreground,
    sourceMode,
    primary, secondary, wallpaper, a11y,
    comparison: { meanDeltaE: cmp.meanDeltaE, meanSimilarity: cmp.meanSimilarity },
    files: allFiles,
  };
}