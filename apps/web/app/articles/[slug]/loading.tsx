import { Skeleton } from "@/components/ui/skeleton";

export default function ArticleLoading() {
  return (
    <main className="shell py-10 sm:py-14" id="main-content">
      <Skeleton className="h-4 w-56" />
      <div className="mx-auto mt-12 max-w-4xl">
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="mt-6 h-20 w-full" />
        <Skeleton className="mt-3 h-20 w-4/5" />
        <Skeleton className="mt-7 h-7 w-full max-w-2xl" />
        <Skeleton className="mt-3 h-7 w-3/5" />
        <Skeleton className="mt-8 h-12 w-52" />
      </div>
      <div className="mx-auto mt-14 max-w-3xl space-y-4">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <Skeleton className="h-6 w-full" key={item} />
        ))}
      </div>
    </main>
  );
}
