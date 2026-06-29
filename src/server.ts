// Color Palette Extractor MCP server.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import sharp from "sharp";
import { extractPalette, type ExtractOpts } from "./extract.js";
import { splitForegroundBackground } from "./window.js";
import { buildDeliverableFolder } from "./build.js";
import { harmonize, type Scheme } from "./harmonize.js";
import { suggestRole, type Purpose } from "./roles.js";
import { exportPalette, type ExportFormat } from "./export.js";
import { comparePalettes } from "./compare.js";
import {
  contrastRatio,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  wcagLevel,
  type Swatch,
} from "./color.js";

const server = new McpServer({
  name: "color-palette-mcp",
  version: "0.1.0",
});

server.tool(
  "extract_palette",
  "Extract a perceptual color palette from an image.",
  {
    image_url: z.string().url().optional(),
    image_path: z.string().optional(),
    count: z.number().int().min(2).max(12).default(5),
    method: z.enum(["kmeans", "mediancut", "octree"]).default("kmeans"),
    ignore_near_white: z.boolean().default(false),
    ignore_near_black: z.boolean().default(false),
    min_population_ratio: z.number().min(0).max(0.5).default(0.001),
  },
  async (args) => {
    const buf = await loadImage(args.image_url, args.image_path);
    const img = sharp(buf).resize({ width: 512, height: 512, fit: "inside" });
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

    const opts: ExtractOpts = {
      count: args.count,
      method: args.method === "octree" ? "kmeans" : args.method,
      ignoreNearWhite: args.ignore_near_white,
      ignoreNearBlack: args.ignore_near_black,
      minPopulationRatio: args.min_population_ratio,
    };

    const palette = extractPalette(data, info.width, info.height, opts);
    storeRecent(palette);

    return {
      content: [
        { type: "text", text: JSON.stringify({ palette: palette.map(simplify) }, null, 2) },
      ],
    };
  }
);

server.tool(
  "build_palette_folder",
  "End-to-end pipeline: detect the app window in a screenshot, extract separate app + wallpaper palettes, derive the inverse theme, render visual previews, export to CSS/SCSS/Tailwind/Figma/JSON, write a README.md, and produce an HTML design-system guide (with PNG screenshot) that has a dark/light toggle. Each invocation creates a unique folder. Use target_mode to control which theme is labelled primary: 'auto' (default — detect from source luminance), 'dark', or 'light'. Both themes are always produced.",
  {
    image_url: z.string().url().optional(),
    image_path: z.string().optional(),
    output_dir: z.string().optional(),
    target_mode: z.enum(["auto", "dark", "light"]).optional(),
  },
  async (args) => {
    if (!args.image_url && !args.image_path) throw new Error("Provide image_url or image_path");

    let src: string | undefined = args.image_path;
    if (!src && args.image_url) {
      // Download to a temp file so build.ts can read from disk
      const fs = await import("node:fs/promises");
      const os = await import("node:os");
      const path = await import("node:path");
      const res = await fetch(args.image_url);
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
      const ext = (args.image_url.split(".").pop() || "png").split("?")[0].slice(0, 5);
      const tmp = path.join(os.tmpdir(), `palette-${Date.now()}.${ext}`);
      await fs.writeFile(tmp, Buffer.from(await res.arrayBuffer()));
      src = tmp;
    }

    const result = await buildDeliverableFolder(src!, {
      outputDir: args.output_dir,
      targetMode: args.target_mode,
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          folder: result.folder,
          hash: result.hash,
          window: result.window,
          source_mode: result.sourceMode,
          primary: result.primary.map((s) => ({ hex: s.hex, role: s.role, population: s.population })),
          secondary: result.secondary.map((s) => ({ hex: s.hex, role: s.role })),
          wallpaper: result.wallpaper.map((s) => ({ hex: s.hex, role: s.role })),
          a11y: result.a11y,
          comparison: result.comparison,
          files: result.files,
        }, null, 2),
      }],
    };
  }
);

// Auto-detect the dominant app/UI window in a screenshot and extract a palette
// from BOTH the foreground (app) and the wallpaper (background). Useful for
// screenshots where the app window sits on top of a gradient or photo — without
// this, kmeans mixes app + wallpaper colors together.
server.tool(
  "extract_app_palette",
  "Detect the app window in a screenshot and extract palettes for the app (foreground) and the wallpaper (background) separately.",
  {
    image_url: z.string().url().optional(),
    image_path: z.string().optional(),
    count: z.number().int().min(2).max(12).default(6),
    min_population_ratio: z.number().min(0).max(0.5).default(0.001),
  },
  async (args) => {
    const buf = await loadImage(args.image_url, args.image_path);
    const { data, info } = await sharp(buf)
      .resize({ width: 600, height: 600, fit: "inside" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const split = splitForegroundBackground(data, info.width, info.height, info.channels);

    const opts: ExtractOpts = {
      count: args.count,
      method: "kmeans",
      minPopulationRatio: args.min_population_ratio,
    };

    const fgPalette = extractPalette(
      split.foregroundPixels,
      split.foreground.width,
      split.foreground.height,
      opts
    );
    let bgPalette: typeof fgPalette = [];
    if (split.backgroundCount > 0) {
      bgPalette = extractPalette(
        split.backgroundPixels,
        split.backgroundCount,
        1,
        opts
      );
    }

    storeRecent(fgPalette);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            window: {
              x: split.foreground.x,
              y: split.foreground.y,
              width: split.foreground.width,
              height: split.foreground.height,
            },
            foreground: { label: "app", palette: fgPalette.map(simplify) },
            background: { label: "wallpaper", count: split.backgroundCount, palette: bgPalette.map(simplify) },
          }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "score_accessibility",
  "Compute WCAG contrast ratios for palette pairs.",
  {
    palette: z.array(z.object({
      hex: z.string(),
      role: z.string().optional(),
    })),
    pairs: z.array(z.tuple([z.string(), z.string()])).optional(),
  },
  async ({ palette, pairs }) => {
    const results: unknown[] = [];
    const list = pairs ?? defaultPairs(palette.map((p) => p.hex));

    for (const [a, b] of list) {
      const ra = hexToRgb(a), rb = hexToRgb(b);
      const ratio = contrastRatio(ra, rb);
      results.push({
        foreground: a,
        background: b,
        ratio: round(ratio, 2),
        AA: ratio >= 4.5,
        AA_Large: ratio >= 3,
        AAA: ratio >= 7,
        AAA_Large: ratio >= 4.5,
        level: wcagLevel(ratio),
      });
    }

    return { content: [{ type: "text", text: JSON.stringify({ results }, null, 2) }] };
  }
);

server.tool(
  "suggest_role",
  "Assign semantic roles (background/text/accent/...) to a palette.",
  {
    palette: z.array(z.object({
      hex: z.string(),
      rgb: z.object({ r: z.number(), g: z.number(), b: z.number() }),
      hsl: z.object({ h: z.number(), s: z.number(), l: z.number() }),
      population: z.number(),
    })),
    purpose: z.enum(["light_theme", "dark_theme", "data_viz", "branding"]),
  },
  async ({ palette, purpose }) => {
    const swatches = palette as Swatch[];
    const result = suggestRole(swatches, purpose as Purpose);
    return {
      content: [{ type: "text", text: JSON.stringify({ palette: result.map(simplify) }, null, 2) }],
    };
  }
);

server.tool(
  "export_palette",
  "Export a palette to a developer/designer file format.",
  {
    palette: z.array(z.object({
      hex: z.string(),
      rgb: z.object({ r: z.number(), g: z.number(), b: z.number() }),
      hsl: z.object({ h: z.number(), s: z.number(), l: z.number() }),
      population: z.number(),
      role: z.string().optional(),
    })),
    name: z.string(),
    format: z.enum(["css_vars", "scss", "tailwind", "figma_tokens", "json", "ase"]),
  },
  async ({ palette, name, format }) => {
    const swatches = palette as Swatch[];
    const out = exportPalette(swatches, name, format as ExportFormat);
    return { content: [{ type: "text", text: out }] };
  }
);

server.tool(
  "harmonize",
  "Generate a harmonic palette from a seed color.",
  {
    seed_hex: z.string(),
    scheme: z.enum(["analogous", "triadic", "complementary", "split", "tetradic", "monochrome"]),
  },
  async ({ seed_hex, scheme }) => {
    const palette = harmonize(seed_hex, scheme as Scheme).map((hex) => {
      const rgb = hexToRgb(hex);
      return { hex, rgb, hsl: rgbToHsl(rgb), population: 0 };
    });
    return {
      content: [{ type: "text", text: JSON.stringify({ palette: palette.map(simplify) }, null, 2) }],
    };
  }
);

server.tool(
  "match_vibe",
  "Suggest a palette for a mood/description. Uses curated anchor palettes per vibe.",
  {
    description: z.string(),
    count: z.number().int().min(3).max(7).default(5),
  },
  async ({ description }) => {
    const palette = matchVibe(description);
    storeRecent(palette);
    return {
      content: [{ type: "text", text: JSON.stringify({ palette: palette.map(simplify) }, null, 2) }],
    };
  }
);

server.tool(
  "compare_palettes",
  "Compute perceptual ΔE2000 distances between two palettes.",
  {
    a: z.array(z.string()),
    b: z.array(z.string()),
  },
  async ({ a, b }) => {
    const result = comparePalettes(a, b);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.resource(
  "palette://recent",
  "Recently extracted palettes from this session.",
  async () => {
    const text = JSON.stringify({ recent: recent.map((p) => p.map(simplify)) }, null, 2);
    return {
      contents: [{ uri: "palette://recent", mimeType: "application/json", text }],
    };
  }
);

server.prompt(
  "design_system_audit",
  "Audit a design system. Pass the extracted palette and ask the model to flag issues.",
  { palette_json: z.string() },
  ({ palette_json }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Audit this palette for design-system quality:\n${palette_json}\n\nFlag: insufficient contrast for text/background, near-duplicates, missing accent or surface roles, and any color whose HSL suggests it's too washed-out or muddy.`,
      },
    }],
  })
);

server.prompt(
  "a11y_fixer",
  "Fix a palette for WCAG AA contrast.",
  { palette_json: z.string() },
  ({ palette_json }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Given this palette, propose a re-tuned version that passes WCAG AA for body text on the background:\n${palette_json}`,
      },
    }],
  })
);

const recent: Swatch[][] = [];
function storeRecent(p: Swatch[]) {
  recent.unshift(p);
  if (recent.length > 20) recent.pop();
}

function defaultPairs(hexes: string[]): [string, string][] {
  if (hexes.length < 2) return [];
  const bg = hexes[0], text = hexes[hexes.length - 1];
  return [[text, bg]];
}

function simplify(s: Swatch) {
  return {
    hex: s.hex,
    rgb: s.rgb,
    hsl: { h: round(s.hsl.h, 1), s: round(s.hsl.s, 1), l: round(s.hsl.l, 1) },
    population: s.population,
    role: s.role,
  };
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

async function loadImage(url?: string, path?: string): Promise<Buffer> {
  if (path) {
    const fs = await import("node:fs/promises");
    return fs.readFile(path);
  }
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }
  throw new Error("Provide image_url or image_path");
}

// Curated mood → palette anchors. Each vibe returns a small palette.
function matchVibe(description: string): Swatch[] {
  const d = description.toLowerCase();
  const seeds: Record<string, string[]> = {
    "forest dusk": ["#1c2a1f", "#3d5a3a", "#7a9b6e", "#c9b27a", "#2a1f17"],
    "sunset desert": ["#3b1f3d", "#c75d4d", "#f0a85a", "#f7e3a1", "#1a0e1f"],
    "ocean morning": ["#0a2540", "#1a5b8a", "#5cb8d6", "#d6f1f5", "#f8f4e3"],
    "tokyo neon": ["#0d0221", "#26025c", "#7d12ff", "#ff2ec4", "#fffb00"],
    "coffee shop": ["#2b1d14", "#6b4226", "#c8a27a", "#e8d7b8", "#f5efe6"],
    "midnight lavender": ["#1a0e2e", "#3d2a5c", "#8a6db5", "#d6c8e8", "#f0eaf5"],
    "pastel spring": ["#fcd3e1", "#a8e6cf", "#dcedc1", "#ffd3b6", "#ffaaa5"],
    "industrial concrete": ["#2a2a2a", "#5c5c5c", "#9a9a9a", "#d6d6d6", "#f0f0f0"],
    "autumn harvest": ["#4a1f0a", "#a04020", "#d9772f", "#e8b04a", "#f5e6c8"],
  };

  let best: string[] = ["#222831", "#393e46", "#00adb5", "#eeeeee", "#ffd369"];
  let bestScore = -Infinity;
  for (const [key, palette] of Object.entries(seeds)) {
    const tokens = key.split(/\s+/);
    let score = 0;
    for (const t of tokens) if (d.includes(t)) score += t.length;
    if (score > bestScore) { bestScore = score; best = palette; }
  }
  return best.map((hex, i) => {
    const rgb = hexToRgb(hex);
    return { hex, rgb, hsl: rgbToHsl(rgb), population: 0, role: `color_${i + 1}` };
  });
}

void rgbToHex;

const transport = new StdioServerTransport();
await server.connect(transport);