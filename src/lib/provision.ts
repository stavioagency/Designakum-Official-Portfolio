import "server-only";
import { createUser } from "./auth";
import { createPortfolio, uniqueSlug } from "./portfolios";
import { seedStarterContent } from "./starter";
import { updateProfile } from "./portfolios";
import type { User } from "./types";

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
}): Promise<{ user: User; slug: string }> {
  const user = await createUser({
    email: input.email,
    password: input.password,
    displayName: input.name,
    googleId: input.googleId,
    avatarUrl: input.avatarUrl,
  });

  const portfolio = await createPortfolio({
    userId: user.id,
    slug: await uniqueSlug(input.slug || input.name || input.email.split("@")[0]),
    name: input.name,
    title: input.title || "مصمم جرافيك",
  });

  await seedStarterContent(portfolio);

  if (input.avatarUrl) {
    await updateProfile(portfolio.id, user, { avatar_url: input.avatarUrl });
  }

  return { user, slug: portfolio.slug };
}
