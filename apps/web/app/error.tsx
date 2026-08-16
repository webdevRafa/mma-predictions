"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="shell grid min-h-[70vh] place-items-center py-16" id="main-content"><div className="max-w-lg text-center"><AlertTriangle aria-hidden="true" className="mx-auto text-fl-warning" size={30} /><p className="eyebrow mt-5">Connection missed</p><h1 className="mt-2 font-display text-5xl font-extrabold">The lobby didn’t load.</h1><p className="mt-4 text-sm leading-6 text-fl-text-muted">Your picks have not been changed. Try loading this view again.</p><Button className="mt-6" onClick={reset}>Try again</Button></div></main>;
}
