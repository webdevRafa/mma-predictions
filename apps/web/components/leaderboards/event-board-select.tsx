"use client";

import { ChevronDown, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface EventBoardOption {
  id: string;
  label: string;
}

export function EventBoardSelect({
  activeBoardId,
  options,
}: {
  activeBoardId?: string | undefined;
  options: EventBoardOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(activeBoardId ?? "");

  if (options.length === 0) return null;

  return (
    <div className="min-w-0 sm:min-w-72">
      <label
        className="mb-2 block font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase"
        htmlFor="event-leaderboard"
      >
        By event
      </label>
      <div className="relative">
        <select
          aria-busy={pending}
          className="focus-ring h-12 w-full appearance-none rounded-lg border border-fl-border bg-fl-surface-1 px-4 pr-11 text-sm font-bold text-fl-text transition hover:border-fl-text-muted disabled:cursor-wait disabled:opacity-70"
          disabled={pending}
          id="event-leaderboard"
          onChange={(event) => {
            const boardId = event.target.value;
            setSelected(boardId);
            if (!boardId) return;
            startTransition(() => {
              router.push(
                `/leaderboards?board=${encodeURIComponent(boardId)}`,
                { scroll: false },
              );
            });
          }}
          value={selected}
        >
          <option value="">Choose a completed event</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {pending ? (
          <LoaderCircle
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 animate-spin text-fl-accent"
            size={16}
          />
        ) : (
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-fl-text-dim"
            size={16}
          />
        )}
      </div>
    </div>
  );
}
