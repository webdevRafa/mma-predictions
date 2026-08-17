"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

import { StatusPill, type StatusValue } from "@/components/ui/status-pill";
import {
  getFirebaseClient,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";

export function LiveStatusFragment({
  collection,
  id,
  initialStatus,
}: {
  collection: "events" | "fights";
  id: string;
  initialStatus: StatusValue;
}) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (!isFirebaseClientConfigured) return;
    const { firestore } = getFirebaseClient();
    return onSnapshot(doc(firestore, collection, id), (snapshot) => {
      const nextStatus: unknown = snapshot.get("status");
      if (typeof nextStatus === "string") setStatus(nextStatus as StatusValue);
    });
  }, [collection, id]);

  return (
    <span aria-live="polite" data-live-fragment={`${collection}/${id}`}>
      <StatusPill status={status} />
    </span>
  );
}
