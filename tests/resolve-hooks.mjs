import { registerHooks } from "node:module";

/**
 * Lets a test import the app's own modules directly.
 *
 * Two things stand between plain node and `src/lib`: `server-only`, a specifier
 * that exists only inside Next's build, and TypeScript's extensionless relative
 * imports. Registered here rather than in each test, because a test that
 * reimplements the code it is checking only proves it agrees with itself.
 */
/** `next/headers` only exists inside a request; nothing here is in one. */
const NEXT_HEADERS = `data:text/javascript,${encodeURIComponent(
  "export const headers = async () => new Headers();" +
    "export const cookies = async () => ({ get: () => undefined, set: () => {}, delete: () => {} });" +
    "export const draftMode = async () => ({ isEnabled: false });",
)}`;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (specifier === "next/headers") return { url: NEXT_HEADERS, shortCircuit: true };
    // Our source only. A dependency's own extensionless requires are its
    // business: appending .ts to them broke qrcode, whose lib/index.js requires
    // "./server" and got handed "./server.ts".
    const fromOurCode = !String(context.parentURL ?? "").includes("/node_modules/");
    if (fromOurCode && specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
});
