"use client";

import { CheckCircle2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "./button";

export function ToastPreview() {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <Button variant="ghost" onClick={() => setVisible(true)}>
        Show toast
      </Button>
      {visible ? (
        <div
          aria-live="polite"
          className="fixed right-4 bottom-20 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-fl-success/25 bg-fl-surface-2 px-4 py-3 shadow-2xl sm:bottom-5"
        >
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 text-fl-success"
            size={18}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-fl-text">Pick saved</p>
            <p className="mt-0.5 text-xs text-fl-text-muted">
              You can edit it until walkouts.
            </p>
          </div>
          <button
            aria-label="Dismiss notification"
            className="cursor-pointer text-fl-text-muted hover:text-fl-text"
            onClick={() => setVisible(false)}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
