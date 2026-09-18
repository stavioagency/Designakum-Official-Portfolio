import type { Metadata } from "next";
import { guardPage } from "@/lib/permissions";
import { listErrors } from "@/lib/error-log";
import { currentLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { PageHeader, SectionCard, formatDate } from "@/components/console/ui";
import { resolveErrorAction } from "@/app/actions/errors";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await currentLocale()).console.errors.title };
}

export const dynamic = "force-dynamic";

/**
 * The failures, newest first.
 *
 * Grouped rather than listed one per occurrence: the same fault firing a
 * thousand times is one line with a count beside it, which is the difference
 * between a page you read and a page you scroll past.
 */
export default async function ErrorsPage() {
  await guardPage("settings.manage");
  const locale = await currentLocale();
  const t = dict(locale).console.errors;
  const errors = await listErrors();

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />

      {errors.length === 0 ? (
        <SectionCard title={t.empty}>
          <p className="px-5 py-6 text-[13.5px] leading-relaxed text-mist-400">{t.emptyBody}</p>
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {errors.map((error) => (
            <article key={error.fingerprint} className="card p-5">
              {/* Stacked on a phone, and every value able to break: an area
                  name and a message both come from whatever threw, so neither
                  can be assumed short or to contain a space. */}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="break-all text-[12px] font-medium uppercase tracking-wide text-mist-500">
                    {error.area || "unknown"}
                  </p>
                  <p className="mt-1 [overflow-wrap:anywhere] text-[14.5px] font-semibold">{error.message}</p>
                  <p className="tnum mt-1.5 text-[12.5px] text-mist-500">
                    {error.count}× · {formatDate(Number(error.last_seen), locale)}
                  </p>
                </div>

                <form action={resolveErrorAction} className="shrink-0">
                  <input type="hidden" name="fingerprint" value={error.fingerprint} />
                  <button type="submit" className="btn btn-ghost !px-3 !py-1.5 !text-[12px]">
                    {t.resolve}
                  </button>
                </form>
              </div>

              {error.stack && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[12.5px] text-mist-400">
                    {t.details}
                  </summary>
                  <pre
                    dir="ltr"
                    className="no-scrollbar mt-2 max-h-64 overflow-auto rounded-xl bg-black/30 p-3 text-[11.5px] leading-relaxed text-mist-400"
                  >
                    {error.stack}
                  </pre>
                </details>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
