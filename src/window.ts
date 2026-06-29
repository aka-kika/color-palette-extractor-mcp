// Window/foreground detection for screenshots.
// Finds the dominant rectangular app/UI region by row+column density scan of
// "dim and desaturated" pixels (typical of app panels). Returns the bbox and
// the foreground (app) / background (wallpaper) split.
import type { RGB } from "./color.js";

export type BBox = { x: number; y: number; width: number; height: number };

export type Split = {
  foreground: BBox;
  foregroundPixels: Buffer;
  foregroundChannels: number;
  backgroundPixels: Buffer;
  backgroundCount: number;
  density: { rowDensity: number[]; colDensity: number[] };
};

/**
 * Decide whether a pixel belongs to the "app" (dim, desaturated panel) or
 * the wallpaper/background (brighter or more chromatic). Tuned for dark UI
 * screenshots on macOS / iOS / web, where the app window is dark navy and
 * the wallpaper is a gradient or photo.
 */
export function isForegroundPixel(r: number, g: number, b: number): boolean {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const sat = max - min;
  // App: dim (<75 luma) AND low saturation (<35)
  return y < 75 && sat < 35;
}

/**
 * Detect the bounding box of the largest foreground region by row/column
 * density scan, then return the cropped foreground buffer plus a packed
 * background buffer.
 *
 * @param data Raw pixel buffer (RGB or RGBA).
 * @param width Image width.
 * @param height Image height.
 * @param channels 3 (RGB) or 4 (RGBA).
 */
export function splitForegroundBackground(
  data: Buffer,
  width: number,
  height: number,
  channels: number
): Split {
  // Per-row density
  const rowDensity: number[] = new Array(height);
  for (let y = 0; y < height; y++) {
    let app = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (isForegroundPixel(data[i], data[i + 1], data[i + 2])) app++;
    };
    rowDensity[y] = app / width;
  }

  // Find first and last row where density > 0.5
  let top = rowDensity.findIndex((d) => d > 0.5);
  if (top < 0) top = 0;
  let bottom = height - 1 - [...rowDensity].reverse().findIndex((d) => d > 0.5);

  // Per-column density within the row range
  const colDensity: number[] = new Array(width);
  for (let x = 0; x < width; x++) {
    let app = 0;
    for (let y = top; y <= bottom; y++) {
      const i = (y * width + x) * channels;
      if (isForegroundPixel(data[i], data[i + 1], data[i + 2])) app++;
    };
    colDensity[x] = app / Math.max(1, bottom - top + 1);
  }
  let left = colDensity.findIndex((d) => d > 0.5);
  if (left < 0) left = 0;
  let right = width - 1 - [...colDensity].reverse().findIndex((d) => d > 0.5);

  const fw = right - left + 1;
  const fh = bottom - top + 1;
  const fgBuf = Buffer.alloc(fw * fh * channels);
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const s = ((top + y) * width + (left + x)) * channels;
      const d = (y * fw + x) * channels;
      fgBuf[d] = data[s];
      fgBuf[d + 1] = data[s + 1];
      fgBuf[d + 2] = data[s + 2];
      if (channels === 4) fgBuf[d + 3] = data[s + 3];
    };
  }

  // Pack background (everything outside the bbox) into a tight buffer.
  const bgSize = width * height * channels;
  const bgBuf = Buffer.alloc(bgSize);
  let bgCount = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x >= left && x <= right && y >= top && y <= bottom;
      if (inside) continue;
      const s = (y * width + x) * channels;
      const d = bgCount * channels;
      bgBuf[d] = data[s];
      bgBuf[d + 1] = data[s + 1];
      bgBuf[d + 2] = data[s + 2];
      if (channels === 4) bgBuf[d + 3] = data[s + 3];
      bgCount++;
    };
  }

  return {
    foreground: { x: left, y: top, width: fw, height: fh },
    foregroundPixels: fgBuf,
    foregroundChannels: channels,
    backgroundPixels: bgBuf.slice(0, bgCount * channels),
    backgroundCount: bgCount,
    density: { rowDensity, colDensity },
  };
}

void ({} as RGB);