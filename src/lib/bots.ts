import "server-only";
import { headers } from "next/headers";

/**
 * Crawlers are the bulk of traffic to a page nobody has shared yet, and a
 * designer reading "312 views" that are all Googlebot is worse than a designer
 * reading nothing. Counting is best-effort — a determined scraper spoofs its
 * user agent — so this only has to catch the honest ones, which is most of them.
 */

const BOT_TOKENS = [
  // Search and SEO
  "bot", "crawler", "spider", "crawling",
  "googlebot", "bingbot", "yandex", "baiduspider", "duckduckbot", "applebot",
  "ahrefs", "semrush", "mj12bot", "dotbot", "petalbot", "seznambot",
  // AI and archive
  "gptbot", "oai-searchbot", "chatgpt-user", "claudebot", "claude-web",
  "anthropic-ai", "perplexitybot", "ccbot", "bytespider", "ia_archiver",
  // Link preview fetchers — a WhatsApp share fires one of these before any
  // human opens the link, so they would double every shared portfolio.
  "facebookexternalhit", "whatsapp", "twitterbot", "slackbot", "discordbot",
  "linkedinbot", "telegrambot", "skypeuripreview", "embedly", "quora link preview",
  "pinterest", "redditbot", "vkshare", "w3c_validator",
  // Monitoring and tooling
  "uptimerobot", "pingdom", "statuscake", "lighthouse", "headlesschrome",
  "phantomjs", "curl/", "wget/", "python-requests", "python-urllib",
  "go-http-client", "java/", "okhttp", "axios/", "node-fetch", "libwww-perl",
  "postmanruntime", "insomnia",
];

/** True when the user agent belongs to something that is not a person. */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // every real browser sends one
  const ua = userAgent.toLowerCase();
  if (BOT_TOKENS.some((token) => ua.includes(token))) return true;
  // Browsers all still claim Mozilla/5.0 for historical reasons; scripts rarely do.
  return !ua.includes("mozilla/");
}

/** Reads the current request's user agent and classifies it. */
export async function callerIsBot(): Promise<boolean> {
  return isBotUserAgent((await headers()).get("user-agent"));
}
