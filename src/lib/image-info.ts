/**
 * Reads an image's real format and pixel dimensions from its header, without
 * decoding it.
 *
 * Two things this defends against. A decompression bomb is a tiny file that
 * declares enormous dimensions — 40 KB on the wire, 40 000 × 40 000 pixels once
 * anything tries to render it — and file size alone cannot see it. And a
 * `Content-Type` sent by a browser is just a claim; the magic bytes are not.
 *
 * Pure parsing, no native dependency: the project runs on Vercel's Node runtime
 * and adding an image library for two integers is not a trade worth making.
 */

export interface ImageInfo {
  /** The format the bytes actually are, regardless of what was claimed. */
  mime: string;
  width: number;
  height: number;
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) =>
  ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);

const ascii = (b: Uint8Array, i: number, length: number) =>
  String.fromCharCode(...b.subarray(i, i + length));

export function imageInfo(bytes: Uint8Array): ImageInfo | null {
  return png(bytes) ?? gif(bytes) ?? webp(bytes) ?? jpeg(bytes) ?? avif(bytes);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function png(b: Uint8Array): ImageInfo | null {
  if (b.length < 24) return null;
  if (!PNG_SIGNATURE.every((byte, i) => b[i] === byte)) return null;
  // The first chunk of a valid PNG is always IHDR, and it starts at byte 8.
  if (ascii(b, 12, 4) !== "IHDR") return null;
  return { mime: "image/png", width: u32be(b, 16), height: u32be(b, 20) };
}

function gif(b: Uint8Array): ImageInfo | null {
  if (b.length < 10) return null;
  const header = ascii(b, 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") return null;
  return { mime: "image/gif", width: u16le(b, 6), height: u16le(b, 8) };
}

function webp(b: Uint8Array): ImageInfo | null {
  if (b.length < 30) return null;
  if (ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;

  const chunk = ascii(b, 12, 4);

  // Lossy: a VP8 keyframe header, dimensions as 14-bit values after the
  // three-byte start code 0x9d 0x01 0x2a.
  if (chunk === "VP8 ") {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return {
      mime: "image/webp",
      width: u16le(b, 26) & 0x3fff,
      height: u16le(b, 28) & 0x3fff,
    };
  }

  // Lossless: 14 bits of width-1 then 14 bits of height-1, packed little-endian
  // across four bytes after the 0x2f signature.
  if (chunk === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return {
      mime: "image/webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }

  // Extended (animation, alpha, metadata): an explicit canvas size, minus one.
  if (chunk === "VP8X") {
    return {
      mime: "image/webp",
      width: u24le(b, 24) + 1,
      height: u24le(b, 27) + 1,
    };
  }

  return null;
}

// Every start-of-frame marker. The others (APPn, DQT, DHT…) are skipped by length.
const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpeg(b: Uint8Array): ImageInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;

  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++; // resynchronise rather than give up; padding between segments is legal
      continue;
    }
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    // Standalone markers carry no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // end of image, or entropy data

    const length = u16be(b, i + 2);
    if (length < 2) return null;

    if (SOF_MARKERS.has(marker)) {
      return { mime: "image/jpeg", height: u16be(b, i + 5), width: u16be(b, i + 7) };
    }
    i += 2 + length;
  }
  return null;
}

/**
 * AVIF and HEIF are ISOBMFF. Rather than walk the full box tree for one value,
 * find the `ispe` (image spatial extents) box, which carries the canvas size and
 * appears early, inside the metadata that precedes the compressed data.
 */
function avif(b: Uint8Array): ImageInfo | null {
  if (b.length < 32 || ascii(b, 4, 4) !== "ftyp") return null;

  const brand = ascii(b, 8, 4);
  const compatible = ascii(b, 8, Math.min(40, b.length - 8));
  if (brand !== "avif" && brand !== "avis" && !compatible.includes("avif")) return null;

  const limit = Math.min(b.length - 16, 8192);
  for (let i = 0; i < limit; i++) {
    if (b[i] === 0x69 && b[i + 1] === 0x73 && b[i + 2] === 0x70 && b[i + 3] === 0x65) {
      // 'ispe' then a 4-byte version/flags, then width and height.
      return { mime: "image/avif", width: u32be(b, i + 8), height: u32be(b, i + 12) };
    }
  }
  return null;
}
