"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { attachDomain, detachDomain } from "@/lib/vercel-domains";
import { canPublish } from "@/lib/billing";
import { get } from "@/lib/db";
import {
  addDomain,
  checkDomain,
  recordCheck,
  removeDomain,
  type Domain,
} from "@/lib/domains";
import { getPortfolioForUser, TenantError } from "@/lib/portfolios";
import { messages } from "@/lib/locale";
import { requestOrigin } from "@/lib/origin";
import { audit } from "@/lib/audit";

export type DomainState = { error?: string; ok?: string } | null;

const say = async (key: "error" | "ok", message: string): Promise<DomainState> =>
  ({ [key]: message });

/** The hostname customers point their CNAME at. */
export async function platformTarget(): Promise<string> {
  return new URL(await requestOrigin()).hostname;
}

async function mine(): Promise<{ portfolioId: string; paid: boolean }> {
  const user = await requireUser();
  const portfolio = await getPortfolioForUser(user.id);
  if (!portfolio) throw new TenantError((await messages()).portfolioNotFound);
  return { portfolioId: portfolio.id, paid: await canPublish(user) };
}

export async function addDomainAction(_prev: DomainState, fd: FormData): Promise<DomainState> {
  const m = await messages();
  try {
    const user = await requireUser();
    const { portfolioId, paid } = await mine();
    // A domain that resolves to an unpublished page helps nobody, and the
    // feature is part of what a subscription buys.
    if (!paid) return await say("error", m.domainNeedsPlan);

    const domain = await addDomain(portfolioId, user, String(fd.get("hostname") ?? ""));

    /**
     * Recorded first, then handed to the host.
     *
     * In that order because the record is ours and the host is somebody else's
     * service: if this call fails the customer still owns the domain here, sees
     * the records to add, and a later verification or a member of staff can
     * finish the job. The other order loses their work to an outage.
     */
    const attached = await attachDomain(domain.hostname);

    await audit({
      actor: user,
      action: "domain.added",
      targetType: "portfolio",
      targetId: portfolioId,
      targetLabel: `${domain.hostname} (${attached.detail})`,
    });

    revalidatePath("/dashboard/domain");
    if (attached.detail === "taken") return await say("error", m.domainHeldElsewhere);
    // Not configured is the platform's own business, not something to tell a
    // customer about: a member of staff attaches it by hand, as they did before
    // this existed.
    if (!attached.ok && attached.detail !== "not-configured") {
      return await say("ok", m.domainPendingHost);
    }
    return await say("ok", m.domainAdded);
  } catch (error) {
    if (error instanceof TenantError) return await say("error", error.message);
    throw error;
  }
}

export async function checkDomainAction(_prev: DomainState, fd: FormData): Promise<DomainState> {
  const m = await messages();
  const user = await requireUser();
  const { portfolioId } = await mine();

  const domain = await get<Domain>(
    "SELECT * FROM domains WHERE id = ? AND portfolio_id = ?",
    String(fd.get("id") ?? ""),
    portfolioId,
  );
  if (!domain) return await say("error", m.failed);

  const result = await checkDomain(domain, await platformTarget());
  const reason = result.reason ? m[result.reason] : "";
  await recordCheck(domain, result, reason);

  revalidatePath("/dashboard/domain");
  return result.ok ? await say("ok", m.domainVerified) : await say("error", reason);
}

export async function removeDomainAction(_prev: DomainState, fd: FormData): Promise<DomainState> {
  const user = await requireUser();
  const { portfolioId } = await mine();

  // Read before it is gone, so the hostname can be released on the host too. A
  // domain left claimed there blocks everyone from ever adding it again,
  // including this customer on their second attempt.
  const domain = await get<Domain>(
    "SELECT * FROM domains WHERE id = ? AND portfolio_id = ?",
    String(fd.get("id") ?? ""),
    portfolioId,
  );

  await removeDomain(String(fd.get("id") ?? ""), user);
  if (domain) await detachDomain(domain.hostname);
  revalidatePath("/dashboard/domain");
  return await say("ok", (await messages()).domainRemoved);
}
