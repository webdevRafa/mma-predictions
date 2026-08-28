import type { FightResult } from "@fightlobby/domain";
import { Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatFightResult } from "@/lib/fight-result";

export function FightResultBadge({
  className,
  result,
}: {
  className?: string;
  result: FightResult;
}) {
  return (
    <Badge
      className={cn(
        "h-auto min-h-6 max-w-full gap-1.5 py-1.5 leading-tight whitespace-normal",
        className,
      )}
      title={formatFightResult(result)}
      tone={result.winnerFighterId ? "success" : "neutral"}
    >
      {result.winnerFighterId ? (
        <Trophy aria-hidden="true" className="shrink-0" size={12} />
      ) : null}
      <span>{formatFightResult(result)}</span>
    </Badge>
  );
}
