import { Skeleton } from "@/components/ui/skeleton";

export default function FightLoading() {
  return (
    <main className="shell py-10" id="main-content">
      <Skeleton className="h-4 w-72" />
      <div className="mt-10 grid grid-cols-[1fr_auto_1fr] gap-5">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-12 w-10 self-center" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-[38rem] rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </main>
  );
}
