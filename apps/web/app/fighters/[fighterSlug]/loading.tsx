import { Skeleton } from "@/components/ui/skeleton";

export default function FighterLoading() {
  return (
    <main className="shell py-12" id="main-content">
      <Skeleton className="h-4 w-52" />
      <div className="mt-10 flex items-center gap-8">
        <Skeleton className="size-40 rounded-full" />
        <Skeleton className="h-28 max-w-2xl flex-1" />
      </div>
      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-[38rem] rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </main>
  );
}
