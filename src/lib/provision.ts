import "server-only";
import { emailTemplate } from "./emails";
import { sendMail } from "./mailer";
import { siteUrl } from "./site";
import { reportError } from "./observability";
import { createUser } from "./auth";
import { createPortfolio, uniqueSlug } from "./portfolios";
import { seedStarterContent, starterTitle } from "./starter";
import { updateProfile } from "./portfolios";
import { DEFAULT_LOCALE } from "./i18n";
import type { Locale, User } from "./types";

/**
 * The single path that turns a new sign-up into a usable account: user, portfolio,
 * and enough starter content that the first visit to the dashboard shows a real
 * page rather than an empty form. Used by password sign-up, Google sign-in and
 * owner-created clients alike.
 */
export async function provisionClient(input: {
  email: string;
  password?: string;
  name: string;
  title?: string;
  slug?: string;
  googleId?: string;
  avatarUrl?: string;
  /** The language chosen at the gate. Decides the starter copy and their mail. */
  locale?: Locale;
  /** Set by the sign-up routes: the customer picks their link on /welcome. */
  chooseOwnLink?: boolean;
}): Promise<{ user: User; slug: string }> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const user = await createUser({
    email: input.email,
    password: input.password,
    displayName: input.name,
    googleId: input.googleId,
    avatarUrl: input.avatarUrl,
    locale,
    chooseOwnLink: input.chooseOwnLink,
  });

  const portfolio = await createPortfolio({
    userId: user.id,
    slug: await uniqueSlug(input.slug || input.name || input.email.split("@")[0]),
    name: input.name,
    title: input.title || starterTitle(locale),
    locale,
  });

  await seedStarterContent(portfolio, locale);

  if (input.avatarUrl) {
    await updateProfile(portfolio.id, user, { avatar_url: input.avatarUrl });
  }

  await sendWelcome(user, portfolio.slug, locale);

  return { user, slug: portfolio.slug };
}

/**
 * The one email a new account gets. It carries the page's URL, because the URL
 * is the thing people actually signed up for and the thing they will want to
 * find again a week later.
 *
 * It lives here, beside the account it belongs to, rather than in the sign-up
 * action. It used to sit in the password route, which meant Google sign-ups —
 * added later, provisioning through this same function — silently sent nothing.
 * Every way of creating an account comes through here, so this is the only place
 * it cannot be forgotten from.
 *
 * Never blocks the sign-up: a mail provider being down is not a reason to refuse
 * someone an account, so a failure is recorded in mail_outbox and dropped here.
 */
async function sendWelcome(user: User, slug: string, locale: Locale) {
  try {
    const origin = await siteUrl();
    const composed = emailTemplate.welcome(locale, {
      name: user.display_name || "",
      portfolioUrl: `${origin}/p/${slug}`,
      dashboardUrl: `${origin}/dashboard`,
    });
    await sendMail({ to: user.email, kind: "welcome", ...composed });
  } catch (error) {
    reportError(error, { area: "welcome-email", userId: user.id });
  }
}
