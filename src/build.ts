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

async function renderThemePair(dark: any[], light: any[], opts: any): Promise<Buffer> {
  const { tileSize = 200, gap = 14, title = "", bg = "#0f1117" } = opts;
  const n = dark.length;
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

  const darkLabel = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${labelH}">
    <text x="20" y="28" font-family="-apple-system, system-ui, sans-serif" font-size="14" font-weight="700" fill="#cccccc" letter-spacing="2">DARK</text>
  </svg>`);
  comps.push({ input: darkLabel, top: titleH, left: 0 });
  for (let i = 0; i < n; i++) {
    const buf = await renderTile(dark[i], tileSize);
    comps.push({ input: buf, top: titleH + labelH, left: i * (tileSize + gap) });
  }

  const lightLabel = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${labelH}">
    <text x="20" y="28" font-family="-apple-system, system-ui, sans-serif" font-size="14" font-weight="700" fill="#cccccc" letter-spacing="2">LIGHT</text>
  </svg>`);
  comps.push({ input: lightLabel, top: titleH + blockH, left: 0 });
  for (let i = 0; i < n; i++) {
    const buf = await renderTile(light[i], tileSize);
    comps.push({ input: buf, top: titleH + blockH + labelH, left: i * (tileSize + gap) });
  }

  const baseSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${bg}"/>
  </svg>`;
  return sharp(Buffer.from(baseSvg)).composite(comps).png().toBuffer();
}

// --- role assignment ---
function pickDarkRoles(swatches: any[]): any[] {
  const sorted = [...swatches].sort((a, b) => b.population - a.population);
  const bg = sorted[0];

  // Text = lightest cluster (highest l) regardless of saturation.
  const byL = [...swatches].sort((a, b) => b.hsl.l - a.hsl.l);
  const text = byL[0];

  // Accent = highest saturation among remaining clusters (skips bg + text).
  const remaining = swatches.filter((s) => s.hex !== bg.hex && s.hex !== text.hex);
  const bySat = [...remaining].sort((a, b) => b.hsl.s - a.hsl.s);
  const accent = bySat[0];

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

function pickLightDerivative(darkSwatches: any[]): any[] {
  return darkSwatches.map((s) => {
    const hsl = s.hsl;
    let targetL: number, targetS: number;
    switch (s.role) {
      case "background": targetL = 97; targetS = 0.15; break;
      case "surface":    targetL = 92; targetS = 0.25; break;
      case "text":       targetL = 16; targetS = 0.15; break;
      case "accent":     targetL = 48; targetS = 0.85; break;
      default:           targetL = 50; targetS = 0.50;
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

function htmlGuide(opts: any): string {
  const { title, src, window: win, appDark, appLight, wallpaper, a11y } = opts;
  const renderCard = (s: any) => `
    <div class="swatch">
      <div class="chip" style="background:${s.hex}">
        <span class="role">${s.role}</span>
        <span class="hex">${s.hex.toUpperCase()}</span>
        <span class="pop">${s.population ? s.population.toLocaleString() + " px" : ""}</span>
      </div>
      <div class="meta">
        <div><span class="k">RGB</span> <span class="v">${Math.round(s.rgb.r)}, ${Math.round(s.rgb.g)}, ${Math.round(s.rgb.b)}</span></div>
        <div><span class="k">HSL</span> <span class="v">${Math.round(s.hsl.h)}°, ${Math.round(s.hsl.s)}%, ${Math.round(s.hsl.l)}%</span></div>
      </div>
    </div>`;

  const renderThemeBlock = (label: string, swatches: any[], bgHex: string) => {
    const rows = swatches.map((s) => {
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
    return `
      <section class="theme ${label.toLowerCase()}">
        <h2>${label} theme</h2>
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
  :root {
    --bg: #0f1117;
    --panel: #1c2030;
    --border: #2a2f42;
    --text: #e8e9ee;
    --muted: #8a92a8;
    --accent: #4f6bce;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 -apple-system, system-ui, "SF Pro Text", sans-serif; background: var(--bg); color: var(--text); }
  header { padding: 32px 40px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  header h1 { margin: 0; font-size: 22px; }
  header .meta { color: var(--muted); font-size: 13px; }
  main { max-width: 1100px; margin: 0 auto; padding: 32px 40px 80px; }
  section { margin-bottom: 56px; }
  h2 { font-size: 18px; margin: 0 0 20px; letter-spacing: 0.5px; }
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
  th { background: rgba(255,255,255,0.03); font-size: 12px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
  code { font-family: ui-monospace, "SF Mono", monospace; font-size: 13px; }
  .dot { width: 14px; height: 14px; border-radius: 4px; display: inline-block; vertical-align: middle; border: 1px solid rgba(255,255,255,0.1); margin-right: 8px; }
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
</style>
</head>
<body>
<header>
  <h1>${title}</h1>
  <div class="meta">generated by color-palette-mcp</div>
</header>
<main>
  <section>
    <h2>Source</h2>
    <div class="src-info">
      <div><span>Source</span><strong><code>${src}</code></strong></div>
      <div><span>Window</span><strong>${win.width}×${win.height} @ (${win.x},${win.y})</strong></div>
      <div><span>App colors</span><strong>${appDark.length}</strong></div>
      <div><span>Wallpaper colors</span><strong>${wallpaper.length}</strong></div>
    </div>
    <div class="preview-row" style="margin-top:16px">
      <img src="app-window-cropped.png" alt="Detected app window">
      <img src="preview-app-pair.png" alt="Dark vs light theme">
    </div>
  </section>
  <section>
    <h2>App theme</h2>
    ${renderThemeBlock("Dark", appDark, appDark.find((s: any) => s.role === "background").hex)}
    ${renderThemeBlock("Light", appLight, appLight.find((s: any) => s.role === "background").hex)}
  </section>
  <section>
    <h2>Accessibility</h2>
    <table>
      <thead><tr><th>Pair</th><th>Foreground</th><th>Background</th><th>Ratio</th><th>Level</th></tr></thead>
      <tbody>${a11yRows}</tbody>
    </table>
  </section>
  <section>
    <h2>Wallpaper (excluded from app)</h2>
    <div class="palette">${wallpaper.map(renderCard).join("")}</div>
    <img src="preview-wallpaper.png" alt="Wallpaper palette" style="width:100%;border-radius:10px;border:1px solid var(--border)">
  </section>
</main>
<footer>Color Palette MCP · ${new Date().toISOString().split("T")[0]}</footer>
</body>
</html>`;
}

export type BuildResult = {
  folder: string;
  hash: string;
  window: { x: number; y: number; width: number; height: number };
  appDark: any[];
  appLight: any[];
  wallpaper: any[];
  a11y: any[];
  comparison: { meanDeltaE: number; meanSimilarity: number };
  files: string[];
};

/**
 * Build a complete deliverable folder for an image: previews, exports, README,
 * HTML design system guide, and PNG screenshot of the guide. Folder name is
 * `{stem}_{timestamp}_{hash}` where stem comes from the source filename.
 */
export async function buildDeliverableFolder(src: string, opts: { outputDir?: string } = {}): Promise<BuildResult> {
  const outDir = opts.outputDir || ROOT;
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

  const appDark = pickDarkRoles(fgRaw);
  const appLight = pickLightDerivative(appDark);
  const wallpaper = pickWallpaperRoles(bgRaw);

  const a11y: any[] = [];
  for (const theme of [{ label: "App dark", sw: appDark }, { label: "App light", sw: appLight }]) {
    const bg = theme.sw.find((s: any) => s.role === "background");
    for (const fg of theme.sw) {
      if (fg.role === "background") continue;
      const ratio = contrastRatio(hexToRgb(fg.hex), hexToRgb(bg.hex));
      a11y.push({ label: `${theme.label} — ${fg.role} on background`, fg: fg.hex, bg: bg.hex, ratio, level: wcagLevel(ratio) });
    }
  }

  const cmp = comparePalettes(appLight.map((s) => s.hex), appDark.map((s) => s.hex));

  await fs.writeFile(`${OUT}/preview-app-dark.png`, await renderStrip(appDark, { title: "APP DARK", tileSize: 200, cols: 4 }));
  await fs.writeFile(`${OUT}/preview-app-light.png`, await renderStrip(appLight, { title: "APP LIGHT", tileSize: 200, cols: 4 }));
  await fs.writeFile(`${OUT}/preview-wallpaper.png`, await renderStrip(wallpaper, { title: "WALLPAPER", tileSize: 200, cols: 4 }));
  await fs.writeFile(`${OUT}/preview-app-pair.png`, await renderThemePair(appDark, appLight, { title: "APP THEME — dark vs light", tileSize: 200 }));
  await fs.writeFile(`${OUT}/preview-all.png`, await renderStrip([...appDark, ...wallpaper], { title: "FULL — app + wallpaper", tileSize: 160, cols: 6 }));

  await fs.mkdir(`${OUT}/exports`, { recursive: true });
  const exportFiles: Record<string, string> = {
    "exports/app-dark.css_vars":  cssVars(appDark, "app-dark"),
    "exports/app-dark.tailwind":  tailwind(appDark, "app-dark"),
    "exports/app-dark.scss":      scss(appDark, "app-dark"),
    "exports/app-dark.json":      jsonOut(appDark, "app-dark"),
    "exports/app-dark.figma":     figmaTokens(appDark, "app-dark"),
    "exports/app-light.css_vars": cssVars(appLight, "app-light"),
    "exports/app-light.tailwind": tailwind(appLight, "app-light"),
    "exports/app-light.scss":     scss(appLight, "app-light"),
    "exports/app-light.json":     jsonOut(appLight, "app-light"),
    "exports/app-light.figma":    figmaTokens(appLight, "app-light"),
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
    window: split.foreground, appDark, appLight, wallpaper, a11y,
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

## Source
- **File:** \`${src.split("/").pop()}\`
- **Detected window:** ${split.foreground.width}×${split.foreground.height} at (${split.foreground.x}, ${split.foreground.y})
- **Hash:** \`${hash}\`

## App palette (extracted from window)

### Dark theme
| Role | Hex | RGB | HSL | Population |
|---|---|---|---|---|
${appDark.map((s: any) => `| ${s.role} | \`${s.hex.toUpperCase()}\` | ${Math.round(s.rgb.r)}, ${Math.round(s.rgb.g)}, ${Math.round(s.rgb.b)} | ${Math.round(s.hsl.h)}°, ${Math.round(s.hsl.s)}%, ${Math.round(s.hsl.l)}% | ${s.population.toLocaleString()} px |`).join("\n")}

### Light theme (derived)
| Role | Hex | RGB | HSL |
|---|---|---|---|
${appLight.map((s: any) => `| ${s.role} | \`${s.hex.toUpperCase()}\` | ${Math.round(s.rgb.r)}, ${Math.round(s.rgb.g)}, ${Math.round(s.rgb.b)} | ${Math.round(s.hsl.h)}°, ${Math.round(s.hsl.s)}%, ${Math.round(s.hsl.l)}% |`).join("\n")}

### Dark vs Light ΔE
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
- \`preview-app-dark.png\`, \`preview-app-light.png\`, \`preview-wallpaper.png\` — palette previews
- \`preview-app-pair.png\` — dark vs light comparison
- \`preview-all.png\` — combined view
- \`index.html\` — interactive design system guide
- \`index.png\` — screenshot of the design system guide
- \`exports/\` — palette in css_vars, scss, tailwind, json, figma_tokens formats

## Preview
![App dark](preview-app-dark.png)

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
    appDark, appLight, wallpaper, a11y,
    comparison: { meanDeltaE: cmp.meanDeltaE, meanSimilarity: cmp.meanSimilarity },
    files: allFiles,
  };
}