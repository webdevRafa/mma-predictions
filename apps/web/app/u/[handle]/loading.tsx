import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <main className="shell py-12" id="main-content">
      <Skeleton className="h-4 w-48" />
      <div className="mt-10 flex items-center gap-7">
        <Skeleton className="size-28 rounded-full" />
        <Skeleton className="h-24 max-w-xl flex-1" />
      </div>
      <Skeleton className="mt-12 h-56 rounded-2xl" />
    </main>
  );
}
