import "server-only";
import QRCode from "qrcode";

/**
 * A QR code for a portfolio, as SVG.
 *
 * SVG rather than a raster: these end up on business cards, table stands and
 * shop windows, printed at sizes nobody tells us in advance. A PNG sized for
 * the screen turns to mush on a card, and one sized for print is a needless
 * download for everyone who only ever looks at it.
 *
 * Black on white, always, and not the portfolio's own colours. A scanner needs
 * contrast between the modules and the quiet zone, and a customer who picks a
 * mid-grey background would otherwise get a code that photographs badly in the
 * one place it matters — someone's hand, in a restaurant, at night.
 */
export async function portfolioQr(url: string): Promise<string> {
  return await QRCode.toString(url, {
    type: "svg",
    // Quartile: about 25% of the code can be obscured and still read. Higher
    // than the default because these get printed, laminated, and smudged.
    errorCorrectionLevel: "Q",
    // In SVG units; the browser scales it. The margin is the quiet zone, and
    // dropping it below 4 modules is the most common reason a code fails to
    // scan when it is printed flush against something else.
    margin: 4,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
