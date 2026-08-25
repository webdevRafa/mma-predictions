import { Skeleton } from "@/components/ui/skeleton";

export default function ArticlesLoading() {
  return (
    <main className="shell py-10 sm:py-14" id="main-content">
      <Skeleton className="h-4 w-36" />
      <div className="mt-10 flex items-end justify-between gap-6">
        <div>
          <Skeleton className="h-14 w-52" />
          <Skeleton className="mt-4 h-5 w-96 max-w-full" />
        </div>
        <Skeleton className="hidden h-12 w-80 sm:block" />
      </div>
      <Skeleton className="mt-10 h-72 rounded-2xl" />
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Skeleton className="h-64 rounded-2xl" key={item} />
        ))}
      </div>
    </main>
  );
}
