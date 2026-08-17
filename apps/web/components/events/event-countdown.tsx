"use client";

import { useEffect, useState } from "react";

function countdownLabel(startsAt: string) {
  const distance = new Date(startsAt).getTime() - Date.now();
  if (distance <= 0) return "Event window open";
  const days = Math.floor(distance / 86_400_000);
  const hours = Math.floor((distance % 86_400_000) / 3_600_000);
  const minutes = Math.floor((distance % 3_600_000) / 60_000);
  return days > 0
    ? `${days}d ${hours}h until the card`
    : `${hours}h ${minutes}m until the card`;
}

export function EventCountdown({ startsAt }: { startsAt: string }) {
  const [label, setLabel] = useState(() => countdownLabel(startsAt));

  useEffect(() => {
    const update = () => setLabel(countdownLabel(startsAt));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [startsAt]);

  return <span aria-live="polite">{label}</span>;
}
