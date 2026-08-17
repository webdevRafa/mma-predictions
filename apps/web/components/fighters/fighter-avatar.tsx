import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

export function FighterAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-14 shrink-0 place-items-center rounded-full border border-fl-border bg-[radial-gradient(circle_at_30%_20%,rgba(241,64,29,.22),transparent_46%),#171c23] font-display text-xl font-extrabold text-fl-text",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
