"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useCallback, useEffect, useState } from "react";

import { useConsent } from "@/features/privacy/consent-provider";
import { trackAnalyticsEvent } from "@/lib/analytics/events";
import { applyGoogleConsent } from "@/lib/privacy/consent";

const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

function WebVitals({ enabled }: { enabled: boolean }) {
  const report = useCallback(
    (metric: {
      id: string;
      name: string;
      value: number;
      rating?: string;
      navigationType?: string;
    }) => {
      if (!enabled) return;
      trackAnalyticsEvent("web_vital", {
        metric_id: metric.id,
        metric_name: metric.name,
        metric_value: Math.round(metric.value),
        metric_rating: metric.rating,
        navigation_type: metric.navigationType,
      });
    },
    [enabled],
  );
  useReportWebVitals(report);
  return null;
}

export function AnalyticsRuntime() {
  const pathname = usePathname();
  const { preferences, resolved } = useConsent();
  const [loaded, setLoaded] = useState(false);
  const enabled = Boolean(resolved && preferences?.analytics && measurementId);

  useEffect(() => {
    if (!enabled || !loaded || !measurementId) return;
    applyGoogleConsent(preferences ?? { analytics: true, advertising: false });
    window.gtag?.("config", measurementId, {
      page_path: pathname,
      send_page_view: true,
      allow_google_signals: preferences?.advertising === true,
      allow_ad_personalization_signals: preferences?.advertising === true,
    });
  }, [enabled, loaded, pathname, preferences]);

  return (
    <>
      <WebVitals enabled={enabled && loaded} />
      {enabled && measurementId ? (
        <Script
          id="fightlobby-google-analytics"
          onReady={() => {
            window.dataLayer = window.dataLayer ?? [];
            window.gtag =
              window.gtag ??
              function gtag(...args: unknown[]) {
                window.dataLayer?.push(args);
              };
            window.gtag("js", new Date());
            setLoaded(true);
          }}
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
          strategy="afterInteractive"
        />
      ) : null}
    </>
  );
}

export function TrackAnalyticsEvent({
  name,
  parameters,
}: {
  name: Parameters<typeof trackAnalyticsEvent>[0];
  parameters?: Parameters<typeof trackAnalyticsEvent>[1];
}) {
  const { preferences, resolved } = useConsent();
  useEffect(() => {
    if (!resolved || preferences?.analytics !== true) return;
    trackAnalyticsEvent(name, parameters);
  }, [name, parameters, preferences?.analytics, resolved]);
  return null;
}
