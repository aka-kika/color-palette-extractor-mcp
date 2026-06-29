// Export a palette into common designer/developer formats.
import type { Swatch } from "./color.js";

export type ExportFormat = "css_vars" | "scss" | "tailwind" | "figma_tokens" | "json" | "ase";

export function exportPalette(palette: Swatch[], name: string, format: ExportFormat): string {
  switch (format) {
    case "css_vars":
      return toCssVars(palette, name);
    case "scss":
      return toScss(palette, name);
    case "tailwind":
      return toTailwind(palette, name);
    case "figma_tokens":
      return toFigmaTokens(palette, name);
    case "json":
      return toJson(palette, name);
    case "ase":
      return toAse(palette, name);
  }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function toCssVars(p: Swatch[], name: string): string {
  const lines = [`/* ${name} */`, ":root {"];
  p.forEach((s, i) => {
    const key = s.role ?? `swatch-${i + 1}`;
    lines.push(`  --${slug(name)}-${slug(key)}: ${s.hex};`);
  });
  lines.push("}");
  return lines.join("\n");
}

function toScss(p: Swatch[], name: string): string {
  const lines = [`// ${name}`];
  p.forEach((s, i) => {
    const key = s.role ?? `swatch-${i + 1}`;
    lines.push(`$${slug(name)}-${slug(key)}: ${s.hex};`);
  });
  return lines.join("\n");
}

function toTailwind(p: Swatch[], name: string): string {
  const slugName = slug(name);
  const lines = [`// tailwind.config — ${name}`, `module.exports = {`, `  theme: {`, `    extend: {`, `      colors: {`];
  p.forEach((s, i) => {
    const key = s.role ?? `${i + 1}`;
    lines.push(`        '${slugName}-${slug(key)}': '${s.hex}',`);
  });
  lines.push("      }", "    }", "  }", "};");
  return lines.join("\n");
}

function toFigmaTokens(p: Swatch[], name: string): string {
  const obj: Record<string, unknown> = { [name]: {} };
  p.forEach((s, i) => {
    const key = s.role ?? `swatch-${i + 1}`;
    (obj[name] as Record<string, unknown>)[key] = { value: s.hex, type: "color" };
  });
  return JSON.stringify(obj, null, 2);
}

function toJson(p: Swatch[], name: string): string {
  return JSON.stringify({
    name,
    colors: p.map((s, i) => ({
      role: s.role ?? `swatch-${i + 1}`,
      hex: s.hex,
      rgb: s.rgb,
      hsl: { h: Math.round(s.hsl.h), s: Math.round(s.hsl.s), l: Math.round(s.hsl.l) },
      population: s.population,
    })),
  }, null, 2);
}

// Adobe Swatch Exchange — minimal, RGB blocks, group name = palette name.
function toAse(p: Swatch[], name: string): string {
  const blocks: Buffer[] = [];
  // ASE binary is big-endian. Header: signature "ASEF" + version 1.0 + block count.
  blocks.push(Buffer.from([0x41, 0x53, 0x45, 0x46]));
  blocks.push(Buffer.from([0x00, 0x01, 0x00, 0x00]));
  blocks.push(Buffer.from([0x00, 0x00, 0x00, p.length + 1])); // group opening + N colors

  // Group start block (type 0xC001).
  blocks.push(Buffer.from([0xC0, 0x01]));
  const groupName = Buffer.from(name + "\0", "utf16le");
  blocks.push(Buffer.from(uint32BE(groupName.length)));
  blocks.push(groupName);
  blocks.push(Buffer.from(uint32BE(0))); // closed=false

  for (const s of p) {
    // Color block (type 0x0001).
    blocks.push(Buffer.from([0x00, 0x01]));
    const swatchName = Buffer.from((s.role ?? s.hex) + "\0", "utf16le");
    blocks.push(Buffer.from(uint32BE(swatchName.length)));
    blocks.push(swatchName);
    blocks.push(Buffer.from("RGB ", "ascii"));
    blocks.push(Buffer.from([
      0x00, 0x00,
      ...float32BE(s.rgb.r / 255),
      ...float32BE(s.rgb.g / 255),
      ...float32BE(s.rgb.b / 255),
      0x00, 0x00, 0x00, 0x00, // color type
    ]));
  }

  // Group end (type 0xC002).
  blocks.push(Buffer.from([0xC0, 0x02]));
  blocks.push(Buffer.from(uint32BE(0)));

  return Buffer.concat(blocks).toString("base64");
}

function uint32BE(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function float32BE(n: number): number[] {
  const buf = Buffer.alloc(4);
  buf.writeFloatBE(n, 0);
  return Array.from(buf);
}