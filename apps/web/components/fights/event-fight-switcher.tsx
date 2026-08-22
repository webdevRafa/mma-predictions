"use client";

import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

export interface EventFightOption {
  slug: string;
  label: string;
  cardSegment: string;
}

interface MenuPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

export function EventFightSwitcher({
  eventName,
  options,
  currentSlug,
  className,
}: {
  eventName: string;
  options: EventFightOption[];
  currentSlug: string;
  className?: string;
}) {
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 8;
    const width = Math.min(360, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(viewportPadding, rect.right - width),
      window.innerWidth - width - viewportPadding,
    );
    const roomBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const roomAbove = rect.top - gap - viewportPadding;
    const openAbove = roomBelow < 280 && roomAbove > roomBelow;
    const maxHeight = Math.max(180, Math.min(420, openAbove ? roomAbove : roomBelow));
    const top = openAbove
      ? Math.max(viewportPadding, rect.top - gap - maxHeight)
      : rect.bottom + gap;
    setMenuPosition({ left, top, width, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      )
        return;
      setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onViewportChange = () => updateMenuPosition();

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open, updateMenuPosition]);

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    setOpen(true);
    requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLElement>("[role='menuitem']")
        ?.focus();
    });
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? [],
    );
    if (items.length === 0) return;

    event.preventDefault();
    const activeIndex = items.findIndex((item) => item === document.activeElement);
    if (event.key === "Home") {
      items[0]?.focus();
      return;
    }
    if (event.key === "End") {
      items.at(-1)?.focus();
      return;
    }

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      activeIndex < 0
        ? direction > 0
          ? 0
          : items.length - 1
        : (activeIndex + direction + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const disabled = options.length <= 1;
  const menu =
    open && menuPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            aria-label={`Other matchups at ${eventName}`}
            className="fight-card-scrollbar fixed z-[100] overflow-y-auto rounded-xl border border-fl-border bg-fl-surface-2 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.62)]"
            id={menuId}
            onKeyDown={onMenuKeyDown}
            ref={menuRef}
            role="menu"
            style={{
              left: menuPosition.left,
              top: menuPosition.top,
              width: menuPosition.width,
              maxHeight: menuPosition.maxHeight,
            }}
          >
            <div className="border-b border-fl-border px-3 py-2.5">
              <p className="eyebrow">Choose another bout</p>
              <p className="mt-1 truncate text-xs font-semibold text-fl-text-muted">
                {eventName}
              </p>
            </div>
            <div className="py-1">
              {options.map((option) => {
                const current = option.slug === currentSlug;
                const content = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-fl-text">
                        {option.label}
                      </span>
                      <span className="mt-1 block font-mono text-[9px] tracking-[0.12em] text-fl-text-dim uppercase">
                        {option.cardSegment}
                      </span>
                    </span>
                    {current ? (
                      <Check
                        aria-label="Current matchup"
                        className="shrink-0 text-fl-success"
                        size={16}
                      />
                    ) : null}
                  </>
                );
                const itemClassName = cn(
                  "focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  current
                    ? "bg-fl-surface-3"
                    : "hover:bg-fl-surface-3 focus:bg-fl-surface-3",
                );
                return current ? (
                  <span
                    aria-current="page"
                    className={itemClassName}
                    key={option.slug}
                    role="menuitem"
                    tabIndex={0}
                  >
                    {content}
                  </span>
                ) : (
                  <Link
                    className={itemClassName}
                    href={`/fights/${option.slug}`}
                    key={option.slug}
                    onClick={() => setOpen(false)}
                    prefetch={false}
                    role="menuitem"
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Choose another bout from ${eventName}`}
        className={cn(
          "focus-ring inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-fl-border bg-fl-surface-2 text-fl-text-muted transition hover:border-fl-accent/50 hover:text-fl-text disabled:cursor-default disabled:opacity-40",
          className,
        )}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onButtonKeyDown}
        ref={buttonRef}
        title="Choose another matchup"
        type="button"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn("transition-transform", open && "rotate-180")}
          size={16}
        />
      </button>
      {menu}
    </>
  );
}
