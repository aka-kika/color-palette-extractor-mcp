// Palette extraction via k-means clustering in RGB space, then re-sorted by perceptual weight.
import { hexToRgb, rgbToHex, rgbToHsl, type RGB, type Swatch } from "./color.js";

type Method = "kmeans" | "mediancut" | "octree";

export type ExtractOpts = {
  count?: number;
  method?: Method;
  ignoreNearWhite?: boolean;
  ignoreNearBlack?: boolean;
  maxDimension?: number;
  // Drop clusters whose population is below this fraction of the largest cluster.
  // Default 0.001 (0.1%). Set to 0 to keep everything kmeans returns.
  minPopulationRatio?: number;
};

// Sample pixels from a raw RGB or RGBA buffer returned by sharp.
export function extractPalette(pixels: Buffer, width: number, height: number, opts: ExtractOpts = {}): Swatch[] {
  const count = Math.max(2, Math.min(12, opts.count ?? 5));
  const method = opts.method ?? "kmeans";
  const maxDim = opts.maxDimension ?? 256;

  // Optional downsample for speed — caller can pre-resize.
  void maxDim;

  // Auto-detect channel count: expected = w*h*4 (RGBA) or w*h*3 (RGB).
  // If neither matches, fall back to 4 (oldest API expectation).
  const expected4 = width * height * 4;
  const expected3 = width * height * 3;
  const channels = pixels.length === expected4 ? 4 : pixels.length === expected3 ? 3 : 4;

  const samples = samplePixels(pixels, width, height, channels, opts.ignoreNearWhite, opts.ignoreNearBlack);

  if (samples.length === 0) {
    return [{ hex: "#000000", rgb: { r: 0, g: 0, b: 0 }, hsl: { h: 0, s: 0, l: 0 }, population: 0 }];
  }

  const initial = kmeansInit(samples, count);
  const allClusters = (method === "kmeans" ? kmeans(samples, initial, 12) : medianCut(samples, count))
    .filter((c) => c.points.length > 0);

  // Filter out tiny clusters so small accents don't get drowned by population sort.
  const maxPop = Math.max(...allClusters.map((c) => c.points.length));
  const minPopRatio = opts.minPopulationRatio ?? 0.001;
  const minPop = Math.max(4, Math.round(maxPop * minPopRatio));
  const clusters = allClusters.filter((c) => c.points.length >= minPop);

  return clusters
    .map((c) => {
      const rgb = centroid(c.points);
      const hex = rgbToHex(rgb);
      return {
        hex,
        rgb,
        hsl: rgbToHsl(rgb),
        population: c.points.length,
      };
    })
    .sort((a, b) => b.population - a.population);
}

function samplePixels(buf: Buffer, w: number, h: number, channels: number = 4, skipWhite: boolean = false, skipBlack: boolean = false): RGB[] {
  const samples: RGB[] = [];
  // Denser sampling than before so small accent regions (status dots, icons,
  // tags) get enough representative pixels to survive clustering.
  const step = Math.max(1, Math.floor(Math.sqrt(w * h) / 280));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * channels;
      if (i + 2 >= buf.length) continue;
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      if (channels === 4) {
        const a = buf[i + 3];
        if (a < 128) continue;
      }
      if (skipWhite && r > 245 && g > 245 && b > 245) continue;
      if (skipBlack && r < 10 && g < 10 && b < 10) continue;
      samples.push({ r, g, b });
    }
  }
  return samples;
}

function dist(a: RGB, b: RGB): number {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function centroid(points: RGB[]): RGB {
  let r = 0, g = 0, b = 0;
  for (const p of points) { r += p.r; g += p.g; b += p.b; }
  const n = points.length;
  return { r: r / n, g: g / n, b: b / n };
}

function kmeansInit(points: RGB[], k: number): RGB[] {
  // k-means++ seeding.
  const seeds: RGB[] = [points[Math.floor(Math.random() * points.length)]];
  while (seeds.length < k) {
    const dists = points.map((p) => {
      let m = Infinity;
      for (const s of seeds) { const d = dist(p, s); if (d < m) m = d; }
      return m;
    });
    const total = dists.reduce((a, b) => a + b, 0);
    let pick = Math.random() * total;
    let chosen = 0;
    for (let i = 0; i < dists.length; i++) {
      pick -= dists[i];
      if (pick <= 0) { chosen = i; break; }
    }
    seeds.push(points[chosen]);
  }
  return seeds;
}

type Cluster = { centroid: RGB; points: RGB[] };

function kmeans(points: RGB[], seeds: RGB[], iterations: number): Cluster[] {
  let centers = seeds.slice();
  for (let iter = 0; iter < iterations; iter++) {
    const clusters: Cluster[] = centers.map((c) => ({ centroid: { ...c }, points: [] }));
    for (const p of points) {
      let bi = 0, bd = dist(p, centers[0]);
      for (let i = 1; i < centers.length; i++) { const d = dist(p, centers[i]); if (d < bd) { bd = d; bi = i; } }
      clusters[bi].points.push(p);
    }
    centers = clusters.map((c) => (c.points.length === 0 ? c.centroid : centroid(c.points)));
  }
  const clusters: Cluster[] = centers.map((c) => ({ centroid: c, points: [] }));
  for (const p of points) {
    let bi = 0, bd = dist(p, centers[0]);
    for (let i = 1; i < centers.length; i++) { const d = dist(p, centers[i]); if (d < bd) { bd = d; bi = i; } }
    clusters[bi].points.push(p);
  }
  return clusters;
}

function medianCut(points: RGB[], k: number): Cluster[] {
  const buckets: RGB[][] = [points];
  while (buckets.length < k) {
    let target = -1, targetRange = -1;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].length < 2) continue;
      const r = bucketRange(buckets[i]);
      if (r > targetRange) { targetRange = r; target = i; }
    }
    if (target === -1) break;
    const b = buckets.splice(target, 1)[0];
    const [b1, b2] = splitBucket(b);
    buckets.push(b1, b2);
  }
  return buckets.map((points) => ({ centroid: centroid(points), points }));
}

function bucketRange(points: RGB[]): number {
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
  for (const p of points) {
    if (p.r < rMin) rMin = p.r; if (p.r > rMax) rMax = p.r;
    if (p.g < gMin) gMin = p.g; if (p.g > gMax) gMax = p.g;
    if (p.b < bMin) bMin = p.b; if (p.b > bMax) bMax = p.b;
  }
  return Math.max(rMax - rMin, gMax - gMin, bMax - bMin);
}

function splitBucket(points: RGB[]): [RGB[], RGB[]] {
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
  for (const p of points) {
    if (p.r < rMin) rMin = p.r; if (p.r > rMax) rMax = p.r;
    if (p.g < gMin) gMin = p.g; if (p.g > gMax) gMax = p.g;
    if (p.b < bMin) bMin = p.b; if (p.b > bMax) bMax = p.b;
  }
  const rR = rMax - rMin, gR = gMax - gMin, bR = bMax - bMin;
  const axis: keyof RGB = rR >= gR && rR >= bR ? "r" : gR >= bR ? "g" : "b";
  points.sort((a, b) => a[axis] - b[axis]);
  const mid = Math.floor(points.length / 2);
  return [points.slice(0, mid), points.slice(mid)];
}