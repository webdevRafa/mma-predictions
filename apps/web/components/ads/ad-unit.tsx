"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { useConsent } from "@/features/privacy/consent-provider";
import { trackAnalyticsEvent } from "@/lib/analytics/events";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

export function AdUnit({
  clientId,
  slotId,
  placement,
  minHeight,
}: {
  clientId: string;
  slotId: string;
  placement: string;
  minHeight: number;
}) {
  const { preferences, resolved } = useConsent();
  const containerRef = useRef<HTMLDivElement>(null);
  const requested = useRef(false);
  const viewed = useRef(false);
  const [scriptReady, setScriptReady] = useState(false);
  const allowed = resolved && preferences?.advertising === true;

  useEffect(() => {
    if (!allowed || !scriptReady || requested.current) return;
    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
      requested.current = true;
    } catch {
      // Ad blockers and provider failures leave the reserved slot intact.
    }
  }, [allowed, scriptReady]);

  useEffect(() => {
    const node = containerRef.current;
    if (!allowed || !node || viewed.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        viewed.current = true;
        trackAnalyticsEvent("ad_slot_viewed", { placement });
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [allowed, placement]);

  return (
    <div
      aria-label="Advertisement"
      className="mx-auto w-full overflow-hidden rounded-xl border border-fl-border bg-fl-surface-1/45"
      ref={containerRef}
      style={{ minHeight }}
    >
      <p className="px-3 pt-2 text-center font-mono text-[9px] tracking-[.12em] text-fl-text-dim uppercase">
        Advertisement
      </p>
      {allowed ? (
        <>
          <Script
            crossOrigin="anonymous"
            id="fightlobby-adsense"
            onReady={() => setScriptReady(true)}
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`}
            strategy="afterInteractive"
          />
          <ins
            className="adsbygoogle block"
            data-ad-client={clientId}
            data-ad-format="auto"
            data-ad-slot={slotId}
            data-full-width-responsive="true"
            style={{ display: "block", minHeight: minHeight - 24 }}
          />
        </>
      ) : (
        <div
          aria-hidden="true"
          className="grid place-items-center px-4 text-center text-xs text-fl-text-dim"
          style={{ minHeight: minHeight - 24 }}
        >
          Optional advertising is not active for this visit.
        </div>
      )}
    </div>
  );
}
