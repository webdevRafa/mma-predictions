import { AdUnit } from "@/components/ads/ad-unit";
import { getRuntimeFeatureFlags } from "@/lib/features/runtime-flags";

const slots = {
  home_after_hero: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_PRIMARY,
  home_mid_card: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_SECONDARY,
  event_after_context: process.env.NEXT_PUBLIC_ADSENSE_SLOT_EVENT_PRIMARY,
  event_between_segments: process.env.NEXT_PUBLIC_ADSENSE_SLOT_EVENT_SECONDARY,
  fight_after_matchup: process.env.NEXT_PUBLIC_ADSENSE_SLOT_FIGHT_PRIMARY,
  fight_after_editorial: process.env.NEXT_PUBLIC_ADSENSE_SLOT_FIGHT_SECONDARY,
} as const;

export type AdPlacement = keyof typeof slots;

export async function AdSlot({
  placement,
  eligible,
  minHeight = 280,
}: {
  placement: AdPlacement;
  eligible: boolean;
  minHeight?: number;
}) {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const certifiedCmpId = process.env.NEXT_PUBLIC_GOOGLE_CERTIFIED_CMP_ID;
  const slotId = slots[placement];
  if (
    !eligible ||
    !/^ca-pub-\d{16}$/.test(clientId ?? "") ||
    !/^\d{5,}$/.test(slotId ?? "") ||
    !certifiedCmpId
  )
    return null;
  const flags = await getRuntimeFeatureFlags();
  if (!flags.adsEnabled) return null;
  return (
    <AdUnit
      clientId={clientId!}
      minHeight={minHeight}
      placement={placement}
      slotId={slotId!}
    />
  );
}
