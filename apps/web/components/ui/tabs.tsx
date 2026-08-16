"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  const generatedId = useId();
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const active = items.find((item) => item.id === activeId) ?? items[0];

  if (!active) return null;

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-fl-border bg-fl-surface-2 p-1" role="tablist" aria-label={label}>
        {items.map((item) => {
          const selected = item.id === active.id;
          return (
            <button
              aria-controls={`${generatedId}-${item.id}-panel`}
              aria-selected={selected}
              className={cn(
                "min-h-10 flex-1 cursor-pointer rounded-lg px-4 text-xs font-bold whitespace-nowrap transition",
                selected
                  ? "bg-fl-surface-3 text-fl-text shadow-sm"
                  : "text-fl-text-muted hover:text-fl-text",
              )}
              id={`${generatedId}-${item.id}-tab`}
              key={item.id}
              onClick={() => setActiveId(item.id)}
              role="tab"
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        aria-labelledby={`${generatedId}-${active.id}-tab`}
        className="pt-4"
        id={`${generatedId}-${active.id}-panel`}
        role="tabpanel"
      >
        {active.content}
      </div>
    </div>
  );
}
