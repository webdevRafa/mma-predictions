# FightLobby brand assets

- `apps/web/public/brand/fightlobby-mark.png` is the production navbar mark exported from Kittl at 3x resolution. The Next.js image pipeline serves an appropriately downscaled variant at runtime.
- `fightlobby-mark-kittl-source.svg` preserves the original Kittl export for provenance and future brand work. Kittl embedded raster image data inside this SVG, so it should not replace the optimized PNG in the application.

The brand system is anchored to the mark's sampled fist red (`#E00C0F`). The interface uses a slightly brighter, accessibility-adjusted red from the same hue family for small text and controls, while brand imagery and subtle glows retain the sampled source color.
