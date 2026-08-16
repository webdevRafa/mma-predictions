"use client";

import { Check, Cookie, Settings2, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  applyGoogleConsent,
  readConsent,
  writeConsent,
  type ConsentChoice,
  type ConsentPreferences,
} from "@/lib/privacy/consent";

interface ConsentContextValue {
  preferences: ConsentPreferences | null;
  resolved: boolean;
  openPreferences: () => void;
}

const ConsentContext = createContext<ConsentContextValue>({
  preferences: null,
  resolved: false,
  openPreferences: () => undefined,
});

export function useConsent() {
  return useContext(ConsentContext);
}

export function openPrivacyChoices() {
  window.dispatchEvent(new Event("fightlobby:open-consent"));
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<ConsentPreferences | null>(
    null,
  );
  const [resolved, setResolved] = useState(false);
  const [open, setOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const stored = readConsent();
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (stored) {
        setPreferences(stored);
        setAnalytics(stored.analytics);
        setAdvertising(stored.advertising);
        applyGoogleConsent(stored);
      } else {
        setOpen(true);
      }
      setResolved(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const openPanel = () => {
      triggerRef.current = document.activeElement as HTMLElement | null;
      setCustomizing(true);
      setOpen(true);
    };
    const cmpUpdate = (event: Event) => {
      const detail = (event as CustomEvent<ConsentChoice>).detail;
      if (
        !detail ||
        typeof detail.analytics !== "boolean" ||
        typeof detail.advertising !== "boolean"
      )
        return;
      save(detail, "certified_cmp");
    };
    window.addEventListener("fightlobby:open-consent", openPanel);
    window.addEventListener("fightlobby:cmp-consent", cmpUpdate);
    return () => {
      window.removeEventListener("fightlobby:open-consent", openPanel);
      window.removeEventListener("fightlobby:cmp-consent", cmpUpdate);
    };
  });

  useEffect(() => {
    if (!open || !customizing) return;
    requestAnimationFrame(() => panelRef.current?.focus());
  }, [customizing, open]);

  function closePanel() {
    setOpen(false);
    setCustomizing(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function save(
    choice: ConsentChoice,
    source: ConsentPreferences["source"] = "fightlobby",
  ) {
    const next = writeConsent(choice, source);
    setPreferences(next);
    setAnalytics(next.analytics);
    setAdvertising(next.advertising);
    applyGoogleConsent(next);
    window.dispatchEvent(
      new CustomEvent("fightlobby:consent-changed", { detail: next }),
    );
    closePanel();
  }

  const value = useMemo(
    () => ({
      preferences,
      resolved,
      openPreferences: () => {
        triggerRef.current = document.activeElement as HTMLElement | null;
        setCustomizing(true);
        setOpen(true);
      },
    }),
    [preferences, resolved],
  );

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {resolved && open ? (
        <section
          aria-label="Privacy choices"
          aria-live="polite"
          className="fixed inset-x-3 bottom-20 z-[80] mx-auto max-w-2xl rounded-2xl border border-fl-border bg-fl-surface-1 p-5 shadow-2xl md:bottom-5"
          ref={panelRef}
          role="dialog"
          tabIndex={-1}
        >
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-fl-accent-soft text-fl-accent">
              <Cookie aria-hidden="true" size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Privacy controls</p>
                  <h2 className="mt-1 font-display text-2xl font-bold">
                    You choose what loads
                  </h2>
                </div>
                {preferences ? (
                  <button
                    aria-label="Close privacy choices"
                    className="focus-ring grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-fl-text-muted hover:bg-fl-surface-2"
                    onClick={closePanel}
                    type="button"
                  >
                    <X aria-hidden="true" size={17} />
                  </button>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-fl-text-muted">
                Essential storage keeps FightLobby secure. Analytics and
                advertising technology stay off unless you allow them. Ads are
                also disabled globally until launch approval.
              </p>

              {customizing ? (
                <div className="mt-5 grid gap-3">
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-fl-border bg-fl-bg p-4">
                    <span>
                      <strong className="block text-sm">Essential</strong>
                      <span className="mt-1 block text-xs text-fl-text-muted">
                        Authentication, security, and saved privacy choices
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-fl-success">
                      <ShieldCheck aria-hidden="true" size={15} /> Always on
                    </span>
                  </div>
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-fl-border bg-fl-bg p-4">
                    <span>
                      <strong className="block text-sm">Analytics</strong>
                      <span className="mt-1 block text-xs text-fl-text-muted">
                        Product usage and performance, without message or email
                        content
                      </span>
                    </span>
                    <input
                      checked={analytics}
                      className="size-5 accent-fl-accent"
                      onChange={(event) => setAnalytics(event.target.checked)}
                      type="checkbox"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-fl-border bg-fl-bg p-4">
                    <span>
                      <strong className="block text-sm">Advertising</strong>
                      <span className="mt-1 block text-xs text-fl-text-muted">
                        Reserved for eligible pages after AdSense and CMP
                        approval
                      </span>
                    </span>
                    <input
                      checked={advertising}
                      className="size-5 accent-fl-accent"
                      onChange={(event) => setAdvertising(event.target.checked)}
                      type="checkbox"
                    />
                  </label>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                {customizing ? (
                  <button
                    className="focus-ring inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-fl-accent px-4 text-xs font-bold text-fl-bg"
                    onClick={() => save({ analytics, advertising })}
                    type="button"
                  >
                    <Check aria-hidden="true" size={15} /> Save choices
                  </button>
                ) : (
                  <>
                    <button
                      className="focus-ring min-h-11 cursor-pointer rounded-lg bg-fl-accent px-4 text-xs font-bold text-fl-bg"
                      onClick={() =>
                        save({ analytics: true, advertising: true })
                      }
                      type="button"
                    >
                      Accept optional technology
                    </button>
                    <button
                      className="focus-ring min-h-11 cursor-pointer rounded-lg border border-fl-border px-4 text-xs font-bold"
                      onClick={() =>
                        save({ analytics: false, advertising: false })
                      }
                      type="button"
                    >
                      Essential only
                    </button>
                    <button
                      className="focus-ring inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-xs font-bold text-fl-text-muted"
                      onClick={() => setCustomizing(true)}
                      type="button"
                    >
                      <Settings2 aria-hidden="true" size={15} /> Customize
                    </button>
                  </>
                )}
                <Link
                  className="focus-ring inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-bold text-fl-text-muted underline"
                  href="/cookie-policy"
                >
                  Cookie policy
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </ConsentContext.Provider>
  );
}
