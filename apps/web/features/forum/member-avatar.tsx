"use client";

import { UserRound } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";

export function MemberAvatar({
  handle,
  photoURL,
  size = "md",
}: {
  handle: string;
  photoURL: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const sizes = {
    sm: "size-8 rounded-lg",
    md: "size-10 rounded-xl",
    lg: "size-12 rounded-xl",
  };
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden border border-fl-border bg-fl-surface-3 font-mono text-xs font-semibold text-fl-text-muted",
        sizes[size],
      )}
    >
      {photoURL && !failed ? (
        <img
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          src={photoURL}
        />
      ) : handle ? (
        handle.slice(0, 1).toUpperCase()
      ) : (
        <UserRound size={18} />
      )}
    </span>
  );
}
