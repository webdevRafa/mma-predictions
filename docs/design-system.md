# FightLobby design system

The launch system is dark-first and uses the canonical FightLobby color tokens. Orange-red marks primary action; pink-red is reserved for a truly live state. Every status includes text, not color alone.

Typography uses Barlow Condensed for matchup headlines, Inter for body/UI copy, and IBM Plex Mono for time, status, and statistics. Fonts are self-hosted by Next.js at build time.

The root shell includes a skip link, visible focus states, responsive header/footer, mobile bottom navigation, offline status, reduced-motion support, and conservative motion. The temporary brand treatment is text-only because the owner is producing the final logo separately.

Component states are available at `/design-system`, which is marked `noindex`.
