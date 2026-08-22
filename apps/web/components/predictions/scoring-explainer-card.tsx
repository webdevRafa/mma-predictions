import { Target } from "lucide-react";

import { Card } from "@/components/ui/card";

export function ScoringExplainerCard({ title }: { title: string }) {
  return (
    <Card className="p-5 sm:p-6">
      <Target aria-hidden="true" className="text-fl-accent" size={22} />
      <h2 className="mt-4 font-display text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-fl-text-muted">
        5 pts for the winner · 3 pts for the method · 2 pts for the exact
        detail. Getting the winner wrong scores 0 for the fight.
      </p>
    </Card>
  );
}
