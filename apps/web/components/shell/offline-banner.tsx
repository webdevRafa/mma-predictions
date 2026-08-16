"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="border-b border-fl-warning/30 bg-fl-warning/10 px-4 py-2 text-center text-xs font-semibold text-fl-warning"
      role="status"
    >
      <WifiOff aria-hidden="true" className="mr-2 inline" size={14} />
      You’re offline. Showing the latest information saved on this device.
    </div>
  );
}
