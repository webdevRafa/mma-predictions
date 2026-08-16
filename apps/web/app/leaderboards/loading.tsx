import { Skeleton } from "@/components/ui/skeleton";

export default function LeaderboardsLoading() {
  return (
    <main className="shell py-16" id="main-content">
      <Skeleton className="h-16 max-w-3xl" />
      <Skeleton className="mt-10 h-16" />
      <Skeleton className="mt-8 h-[32rem]" />
    </main>
  );
}
