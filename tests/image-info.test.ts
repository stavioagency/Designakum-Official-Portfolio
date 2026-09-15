import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { imageInfo } from "../src/lib/image-info.ts";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const le16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff];

function pngOf(width: number, height: number) {
  return bytes(
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...be32(13), ...ascii("IHDR"),
    ...be32(width), ...be32(height),
    8, 6, 0, 0, 0,
  );
}

function jpegOf(width: number, height: number) {
  return bytes(
    0xff, 0xd8,
    // An APP0/JFIF segment first, so the scan has something to skip past.
    0xff, 0xe0, 0x00, 0x10, ...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
    // SOF0
    0xff, 0xc0, 0x00, 0x11, 8,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1,
  );
}

function gifOf(width: number, height: number) {
  return bytes(...ascii("GIF89a"), ...le16(width), ...le16(height), 0xf7, 0, 0);
}

function webpLossyOf(width: number, height: number) {
  return bytes(
    ...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"),
    ...ascii("VP8 "), 0, 0, 0, 0,
    0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a,
    ...le16(width), ...le16(height),
    0, 0,
  );
}

describe("image headers", () => {
  test("reads the dimensions of every format the uploader accepts", () => {
    assert.deepEqual(imageInfo(pngOf(1200, 800)), {
      mime: "image/png",
      width: 1200,
      height: 800,
    });
    assert.deepEqual(imageInfo(jpegOf(1920, 1080)), {
      mime: "image/jpeg",
      width: 1920,
      height: 1080,
    });
    assert.deepEqual(imageInfo(gifOf(64, 48)), { mime: "image/gif", width: 64, height: 48 });
    assert.deepEqual(imageInfo(webpLossyOf(500, 375)), {
      mime: "image/webp",
      width: 500,
      height: 375,
    });
  });

  test("a decompression bomb is visible in the header, not in the file size", () => {
    // 45 bytes on disk, 1.6 billion pixels once decoded.
    const bomb = pngOf(40_000, 40_000);
    assert.ok(bomb.byteLength < 100, "the bomb really is tiny");

    const info = imageInfo(bomb);
    assert.equal(info?.width, 40_000);
    assert.ok(info!.width * info!.height > 40_000_000, "and the header admits it");
  });

  test("the magic bytes override whatever Content-Type claimed", () => {
    const html = new TextEncoder().encode("<script>alert(1)</script>");
    assert.equal(imageInfo(html), null, "an HTML file is not an image whatever it is labelled");

    // An SVG is a real image to a browser, and deliberately unsupported here.
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    assert.equal(imageInfo(svg), null);
  });

  test("truncated and empty input is refused rather than guessed at", () => {
    assert.equal(imageInfo(new Uint8Array(0)), null);
    assert.equal(imageInfo(pngOf(10, 10).subarray(0, 12)), null);
    assert.equal(imageInfo(bytes(0xff, 0xd8)), null, "a JPEG with no frame header");
    assert.equal(imageInfo(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"))), null);
  });
});

/**
 * Hand-built headers prove the edge cases; real files prove the parser agrees
 * with the encoders that actually produce them. These four came out of macOS's
 * own converter and are deliberately non-square, so a swapped width and height
 * cannot pass.
 */
describe("real files", () => {
  const fixture = (name: string) =>
    new Uint8Array(fs.readFileSync(path.join(import.meta.dirname, "fixtures", name)));

  test("matches the encoder for every stored format", () => {
    assert.deepEqual(imageInfo(fixture("wide-700x400.jpg")), {
      mime: "image/jpeg",
      width: 700,
      height: 400,
    });
    assert.deepEqual(imageInfo(fixture("wide-700x400.gif")), {
      mime: "image/gif",
      width: 700,
      height: 400,
    });
    assert.deepEqual(imageInfo(fixture("wide-700x400.avif")), {
      mime: "image/avif",
      width: 700,
      height: 400,
    });
    assert.deepEqual(imageInfo(fixture("tall-333x372.png")), {
      mime: "image/png",
      width: 333,
      height: 372,
    });
  });

  test("reads the WebP the editor's own cropper produces", () => {
    // Chrome's canvas.toBlob writes an extended (VP8X) header with an embedded
    // colour profile, not the plain VP8 chunk a minimal encoder emits. Only the
    // first 64 bytes are needed, and only those are kept.
    const header = (base64: string) => new Uint8Array(Buffer.from(base64, "base64"));

    assert.deepEqual(
      imageInfo(
        header(
          "UklGRqw3AABXRUJQVlA4WAoAAAAgAAAAuwIAjwEASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4A==",
        ),
      ),
      { mime: "image/webp", width: 700, height: 400 },
    );
    assert.deepEqual(
      imageInfo(
        header(
          "UklGRgACAABXRUJQVlA4WAoAAAAgAAAATAEACAMASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4A==",
        ),
      ),
      { mime: "image/webp", width: 333, height: 777 },
    );
  });
});
