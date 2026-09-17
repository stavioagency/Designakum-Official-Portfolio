import Link from "next/link";
import { currentLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { Wordmark } from "@/components/brand/logo";

export default async function NotFound() {
  const d = dict(await currentLocale()).notFound;

  return (
    <main className="relative z-10 flex min-h-dvh items-center justify-center px-6 text-center">
      <div className="card max-w-sm p-8">
        <div className="mb-5 flex justify-center">
          <Wordmark height={26} />
        </div>
        <p className="accent-text text-5xl font-bold">404</p>
        <h1 className="mt-3 text-xl font-bold">{d.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-mist-400">{d.body}</p>
        <Link href="/" className="btn btn-primary mt-6 w-full">{d.cta}</Link>
      </div>
    </main>
  );
}
