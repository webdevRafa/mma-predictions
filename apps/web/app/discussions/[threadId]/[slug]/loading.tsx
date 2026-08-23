import { Skeleton } from "@/components/ui/skeleton";

export default function DiscussionThreadLoading() {
  return (
    <main className="shell py-10 sm:py-14" id="main-content">
      <Skeleton className="h-4 w-64 max-w-full" />
      <div className="mt-10 overflow-hidden rounded-2xl border border-fl-border p-6">
        <Skeleton className="h-12 w-3/4" />
        <div className="mt-6 flex items-center gap-3">
          <Skeleton className="size-10" />
          <div>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-2 h-3 w-36" />
          </div>
        </div>
        <Skeleton className="mt-8 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-5/6" />
        <Skeleton className="mt-3 h-4 w-2/3" />
      </div>
      <Skeleton className="mt-10 h-9 w-40" />
      <div className="mt-5 overflow-hidden rounded-2xl border border-fl-border p-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-5 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-4/5" />
      </div>
    </main>
  );
}
