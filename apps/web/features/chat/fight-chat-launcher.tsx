"use client";

import { MessageCircle, Radio } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trackAnalyticsEvent } from "@/lib/analytics/events";

const FightChatPanel = dynamic(
  () => import("./fight-chat-panel").then((module) => module.FightChatPanel),
  {
    ssr: false,
    loading: () => (
      <Card className="flex min-h-80 items-center justify-center p-6 text-sm text-fl-text-muted">
        Connecting to the lobby…
      </Card>
    ),
  },
);

export function FightChatLauncher({
  roomId,
  fightLabel,
  roomType = "fight",
}: {
  roomId: string;
  fightLabel: string;
  roomType?: "fight" | "event";
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() =>
      triggerRef.current?.querySelector("button")?.focus(),
    );
  };
  if (open)
    return (
      <div
        aria-label={`${roomType} lobby`}
        aria-modal="true"
        className="fixed inset-x-0 top-16 bottom-0 z-40 bg-fl-bg lg:static lg:z-auto lg:bg-transparent"
        role="dialog"
      >
        <FightChatPanel
          fightLabel={fightLabel}
          onClose={close}
          roomId={roomId}
          roomType={roomType}
        />
      </div>
    );

  return (
    <Card>
      <CardHeader
        eyebrow={roomType === "event" ? "Event lobby" : "Fight lobby"}
        title={roomType === "event" ? "Card-wide room" : "Matchup room"}
      />
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <Radio aria-hidden="true" className="text-fl-live" size={16} />
            {roomType === "event" ? "Live event chat" : "Live fight chat"}
          </span>
          <span className="font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
            Loads on demand
          </span>
        </div>
        <p className="mt-4 text-sm leading-6 text-fl-text-muted">
          Read the room without signing in. Verified FightLobby members can
          reply, report, and join the conversation.
        </p>
        <div ref={triggerRef}>
          <Button
            className="mt-5 w-full"
            onClick={() => {
              trackAnalyticsEvent("chat_opened", { room_type: roomType });
              setOpen(true);
            }}
          >
            <MessageCircle aria-hidden="true" size={17} /> Open {roomType} lobby
          </Button>
        </div>
      </div>
    </Card>
  );
}
