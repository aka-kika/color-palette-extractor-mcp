import { describe, it, expect } from "vitest";
import { assertPublicUrl } from "./net.js";

// These cases never hit DNS — literal IPs, localhost, and bad schemes are all
// rejected before any lookup, so the suite stays hermetic/offline.
describe("assertPublicUrl", () => {
  it("rejects loopback and private literal IPs", async () => {
    for (const url of [
      "http://127.0.0.1/",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://172.16.0.1/",
      "http://169.254.169.254/latest/meta-data/", // cloud metadata endpoint
      "http://[::1]/",
    ]) {
      await expect(assertPublicUrl(url)).rejects.toThrow();
    }
  });

  it("rejects local hostnames", async () => {
    await expect(assertPublicUrl("http://localhost/")).rejects.toThrow();
    await expect(assertPublicUrl("http://db.local/")).rejects.toThrow();
  });

  it("rejects non-http(s) schemes", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow();
    await expect(assertPublicUrl("ftp://example.com/x.png")).rejects.toThrow();
  });

  it("rejects malformed URLs", async () => {
    await expect(assertPublicUrl("not a url")).rejects.toThrow();
  });
});
