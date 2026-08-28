import { Skeleton } from "@/components/ui/skeleton";

export default function EventLoading() {
  return (
    <main className="shell py-12" id="main-content">
      <Skeleton className="h-4 w-52" />
      <Skeleton className="mt-8 h-24 w-full max-w-4xl" />
      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-[42rem] rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </main>
  );
}
