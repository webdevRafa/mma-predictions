"use client";

import { ChevronDown } from "lucide-react";

interface EventBoardOption {
  id: string;
  label: string;
}

export function EventBoardSelect({
  activeBoardId,
  onBoardChange,
  options,
}: {
  activeBoardId?: string | undefined;
  onBoardChange: (boardId: string) => void;
  options: EventBoardOption[];
}) {
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
          className="focus-ring h-12 w-full cursor-pointer appearance-none rounded-lg border border-fl-border bg-fl-surface-1 px-4 pr-11 text-sm font-bold text-fl-text transition hover:border-fl-text-muted"
          id="event-leaderboard"
          onChange={(event) => {
            const boardId = event.target.value;
            if (!boardId) return;
            onBoardChange(boardId);
          }}
          value={activeBoardId ?? ""}
        >
          <option value="">Choose a completed event</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-fl-text-dim"
          size={16}
        />
      </div>
    </div>
  );
}
