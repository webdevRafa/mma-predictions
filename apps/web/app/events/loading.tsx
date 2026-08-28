import { Skeleton } from "@/components/ui/skeleton";

export default function EventsLoading() {
  return (
    <main className="shell py-14" id="main-content">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-8 h-16 w-full max-w-2xl" />
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <Skeleton className="h-80 rounded-2xl" key={item} />
        ))}
      </div>
    </main>
  );
}
