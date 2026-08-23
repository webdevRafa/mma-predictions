import { Skeleton } from "@/components/ui/skeleton";

export default function DiscussionsLoading() {
  return (
    <main className="shell py-10 sm:py-14" id="main-content">
      <Skeleton className="h-4 w-36" />
      <div className="mt-10 flex items-end justify-between gap-6">
        <div>
          <Skeleton className="h-14 w-64" />
          <Skeleton className="mt-4 h-5 w-80 max-w-full" />
        </div>
        <Skeleton className="hidden h-11 w-40 sm:block" />
      </div>
      <Skeleton className="mt-8 h-12 w-full max-w-md" />
      <div className="mt-8 overflow-hidden rounded-2xl border border-fl-border">
        {[0, 1, 2].map((row) => (
          <div
            className="border-b border-fl-border p-5 last:border-b-0"
            key={row}
          >
            <Skeleton className="h-7 w-2/5" />
            <Skeleton className="mt-3 h-4 w-4/5" />
            <Skeleton className="mt-2 h-4 w-3/5" />
          </div>
        ))}
      </div>
    </main>
  );
}
