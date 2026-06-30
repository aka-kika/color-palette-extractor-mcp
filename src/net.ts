// Hardened image fetching: blocks SSRF to private/loopback/link-local hosts,
// enforces a request timeout, and caps the downloaded size. Used by every tool
// that accepts an `image_url`.
import dns from "node:dns/promises";
import net from "node:net";

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB
export const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

function isPrivateV4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true; // "this" network
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
  if (mapped) return isPrivateV4(mapped[1]);
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA fc00::/7
  if (/^fe[89ab]/.test(lower)) return true; // link-local fe80::/10
  return false;
}

function isPrivateIp(ip: string): boolean {
  const fam = net.isIP(ip);
  if (fam === 4) return isPrivateV4(ip);
  if (fam === 6) return isPrivateV6(ip);
  return true; // not a recognizable IP → treat as unsafe
}

/**
 * Reject non-http(s) schemes and any URL whose host is — or resolves to — a
 * private/loopback/link-local address. Note: this resolves DNS itself, so there
 * is a small TOCTOU window vs. the actual fetch (DNS rebinding); it stops the
 * common metadata-endpoint / localhost SSRF cases, which is the realistic threat.
 */
export async function assertPublicUrl(raw: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Invalid image_url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol: ${u.protocol}`);
  }
  const host = u.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Refusing to fetch a private/loopback address");
    return;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("Refusing to fetch a local hostname");
  }

  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error(`Cannot resolve host: ${host}`);
  }
  if (addrs.length === 0) throw new Error(`Cannot resolve host: ${host}`);
  for (const a of addrs) {
    if (isPrivateIp(a.address)) throw new Error("Host resolves to a private/loopback address");
  }
}

/**
 * Fetch an image as a Buffer with SSRF protection, a timeout, a size cap, and
 * manual redirect handling (each hop is re-validated, so a public URL cannot
 * redirect into an internal address).
 */
export async function fetchImageBuffer(rawUrl: string): Promise<Buffer> {
  let url = rawUrl;
  let res: Response | undefined;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400 && res.headers.has("location")) {
      if (hop === MAX_REDIRECTS) throw new Error("Too many redirects");
      url = new URL(res.headers.get("location")!, url).toString();
      continue;
    }
    break;
  }

  if (!res) throw new Error("No response");
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);

  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > MAX_IMAGE_BYTES) {
    throw new Error(`Image too large: ${declared} bytes (max ${MAX_IMAGE_BYTES})`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_IMAGE_BYTES) throw new Error("Image exceeds size limit");
    return Buffer.from(ab);
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error("Image exceeds size limit");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
