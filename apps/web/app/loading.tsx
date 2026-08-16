import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main
      className="shell min-h-[70vh] py-16"
      id="main-content"
      aria-busy="true"
      aria-label="Loading page"
    >
      <Skeleton className="h-5 w-28" />
      <Skeleton className="mt-6 h-20 max-w-3xl" />
      <Skeleton className="mt-4 h-5 max-w-xl" />
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </main>
  );
}
