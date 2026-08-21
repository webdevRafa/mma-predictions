"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

type MobileFightSection = "predict" | "stats" | "posts" | "lobby";

const sections: { id: MobileFightSection; label: string }[] = [
  { id: "predict", label: "Predict" },
  { id: "stats", label: "Stats" },
  { id: "posts", label: "Posts" },
  { id: "lobby", label: "Live chat" },
];

export function FightPageWorkspace({
  fighterAName,
  fighterBName,
  prediction,
  stats,
  posts,
  lobby,
  backHref,
  backLabel,
}: {
  fighterAName: string;
  fighterBName: string;
  prediction: ReactNode;
  stats: ReactNode;
  posts: ReactNode;
  lobby: ReactNode;
  backHref: string;
  backLabel: string;
}) {
  const generatedId = useId();
  const [activeSection, setActiveSection] =
    useState<MobileFightSection>("predict");
  const stickyNavRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activate = (section: MobileFightSection, focusTab = false) => {
    setActiveSection(section);
    const index = sections.findIndex((item) => item.id === section);
    if (focusTab) tabRefs.current[index]?.focus();

    requestAnimationFrame(() => {
      const workspace = workspaceRef.current;
      const stickyNav = stickyNavRef.current;
      if (!workspace || !stickyNav) return;
      const panelTop = workspace.getBoundingClientRect().top;
      const stickyBottom = stickyNav.getBoundingClientRect().bottom;
      if (panelTop >= stickyBottom + 8) return;
      window.scrollBy({
        top: panelTop - stickyBottom - 8,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
  };

  const onTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % sections.length;
    if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + sections.length) % sections.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = sections.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextSection = sections[nextIndex];
    if (nextSection) activate(nextSection.id, true);
  };

  const panelId = (section: MobileFightSection) =>
    `${generatedId}-${section}-panel`;
  const tabId = (section: MobileFightSection) =>
    `${generatedId}-${section}-tab`;
  const panelClassName = (section: MobileFightSection) =>
    cn(
      "min-w-0 scroll-mt-40 outline-none",
      activeSection !== section && "hidden md:block",
    );

  return (
    <>
      <nav
        aria-label="Fight page sections"
        className="sticky top-16 z-30 border-b border-fl-border bg-fl-bg/95 shadow-[0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur md:hidden"
        ref={stickyNavRef}
      >
        <div className="border-b border-fl-border/70 bg-fl-surface-1/70">
          <p
            aria-label={`${fighterAName} versus ${fighterBName}`}
            className="shell truncate py-2.5 text-center text-xs font-bold text-fl-text-muted"
            title={`${fighterAName} vs ${fighterBName}`}
          >
            <span className="text-fl-text">{fighterAName}</span>
            <span className="mx-1.5 font-mono text-[9px] tracking-[0.12em] text-fl-accent uppercase">
              vs
            </span>
            <span className="text-fl-text">{fighterBName}</span>
          </p>
        </div>
        <div
          aria-label="Choose fight section"
          className="shell grid grid-cols-4"
          role="tablist"
        >
          {sections.map((section, index) => {
            const selected = section.id === activeSection;
            return (
              <button
                aria-controls={panelId(section.id)}
                aria-selected={selected}
                className={cn(
                  "focus-ring relative min-h-12 cursor-pointer px-1 text-[11px] font-bold transition-colors sm:px-3 sm:text-xs",
                  selected
                    ? "text-fl-text"
                    : "text-fl-text-muted hover:text-fl-text",
                )}
                id={tabId(section.id)}
                key={section.id}
                onClick={() => activate(section.id)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                {section.label}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-fl-accent transition-opacity",
                    selected ? "opacity-100" : "opacity-0",
                  )}
                />
              </button>
            );
          })}
        </div>
      </nav>

      <div
        className="shell grid min-w-0 gap-6 overflow-x-clip py-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8 lg:overflow-visible lg:py-14"
        ref={workspaceRef}
      >
        <div className="contents lg:block lg:min-w-0 lg:space-y-6">
          <section
            aria-labelledby={tabId("predict")}
            className={panelClassName("predict")}
            id={panelId("predict")}
            role="tabpanel"
            tabIndex={0}
          >
            {prediction}
          </section>
          <section
            aria-labelledby={tabId("stats")}
            className={panelClassName("stats")}
            id={panelId("stats")}
            role="tabpanel"
            tabIndex={0}
          >
            <div className="min-w-0 space-y-6">{stats}</div>
          </section>
          <section
            aria-labelledby={tabId("posts")}
            className={panelClassName("posts")}
            id={panelId("posts")}
            role="tabpanel"
            tabIndex={0}
          >
            {posts}
          </section>
          <Link
            className="focus-ring hidden items-center gap-2 rounded-lg text-sm font-bold text-fl-accent lg:inline-flex"
            href={backHref}
          >
            <ArrowLeft aria-hidden="true" size={16} /> {backLabel}
          </Link>
        </div>

        <aside
          aria-labelledby={tabId("lobby")}
          className={cn(
            "min-w-0 scroll-mt-40 outline-none md:block lg:sticky lg:top-24 lg:self-start",
            activeSection !== "lobby" && "hidden",
          )}
          id={panelId("lobby")}
          role="tabpanel"
          tabIndex={0}
        >
          <div className="min-w-0 space-y-5">{lobby}</div>
        </aside>

        <Link
          className="focus-ring inline-flex items-center gap-2 justify-self-start rounded-lg text-sm font-bold text-fl-accent lg:hidden"
          href={backHref}
        >
          <ArrowLeft aria-hidden="true" size={16} /> {backLabel}
        </Link>
      </div>
    </>
  );
}
