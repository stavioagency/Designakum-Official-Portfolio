/**
 * The wordmark, base64, for attaching to outgoing mail.
 *
 * Inline rather than read from public/: a mail send can happen in a webhook or
 * on an edge runtime, neither of which is guaranteed a filesystem or the app's
 * static assets. 8,395 bytes is cheap enough to carry in the bundle.
 *
 * It is attached to each message and referenced as `cid:` instead of linked over
 * https, because Outlook blocks remote images by default and showed the alt text
 * where the logo should have been. An attached image has nothing to fetch.
 *
 * Regenerate from public/brand/wordmark-light.png (sips -Z 300) if the artwork
 * changes. 300px wide for a 150px slot, so it stays sharp on a retina screen.
 */

export const EMAIL_LOGO = {
  cid: "designakum-wordmark",
  filename: "designakum.png",
  contentType: "image/png",
  /** Display size, half the pixel width so it is not soft on a 2x display. */
  width: 150,
  height: 38,
  base64:
    "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",
} as const;
