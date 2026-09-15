export default function ConsoleLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy aria-label="جارٍ التحميل">
      <div className="h-8 w-56 rounded-xl bg-white/[0.06]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[116px] rounded-[28px] bg-white/[0.04]" />
        ))}
      </div>
      <div className="h-72 rounded-[28px] bg-white/[0.04]" />
    </div>
  );
}
