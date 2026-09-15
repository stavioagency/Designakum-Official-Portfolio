import Link from "next/link";
import { Wordmark } from "./brand/logo";
import { AlertTriangle } from "./icons";
import { dict } from "@/lib/i18n";
import { currentLocale } from "@/lib/locale";

export async function MaintenanceNotice({ message, staff }: { message: string; staff: boolean }) {
  const copy = dict(await currentLocale()).maintenance;

  return (
    <main className="relative z-10 grid min-h-dvh place-items-center px-6 text-center">
      <div className="card max-w-md p-8">
        <div className="mb-5 flex justify-center">
          <Wordmark height={26} />
        </div>
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-amber-400/12 text-amber-300">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-bold">{copy.title}</h1>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-mist-400">{message}</p>
        {staff && (
          <Link href="/console" className="btn btn-primary mt-6 w-full">
            {copy.toConsole}
          </Link>
        )}
      </div>
    </main>
  );
}
