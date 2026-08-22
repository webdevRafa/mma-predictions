"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

import { StatusPill, type StatusValue } from "@/components/ui/status-pill";
import {
  getFirebaseClient,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";
import {
  getEventTimingPhase,
  isClockDerivedLive,
  type EventScheduleInput,
} from "@/lib/events/timing";

export function LiveStatusFragment({
  collection,
  id,
  initialStatus,
  eventTiming,
  renderedAt,
}: {
  collection: "events" | "fights";
  id: string;
  initialStatus: StatusValue;
  eventTiming?: EventScheduleInput;
  renderedAt?: number;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [now, setNow] = useState(renderedAt ?? 0);

  useEffect(() => {
    if (!isFirebaseClientConfigured) return;
    const { firestore } = getFirebaseClient();
    return onSnapshot(doc(firestore, collection, id), (snapshot) => {
      const nextStatus: unknown = snapshot.get("status");
      if (typeof nextStatus === "string") setStatus(nextStatus as StatusValue);
    });
  }, [collection, id]);

  useEffect(() => {
    if (!eventTiming) return;
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [eventTiming]);

  const displayedStatus =
    collection === "events" && eventTiming
      ? isClockDerivedLive(
          getEventTimingPhase(
            { ...eventTiming, status: status as EventScheduleInput["status"] },
            now,
          ),
        )
        ? "live"
        : status
      : status;

  return (
    <span aria-live="polite" data-live-fragment={`${collection}/${id}`}>
      <StatusPill status={displayedStatus} />
    </span>
  );
}
