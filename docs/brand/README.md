# FightLobby brand assets

- `apps/web/public/brand/fightlobby-mark.png` is the production navbar mark exported from Kittl at 3x resolution. The Next.js image pipeline serves an appropriately downscaled variant at runtime.
- `fightlobby-mark-kittl-source.svg` preserves the original Kittl export for provenance and future brand work. Kittl embedded raster image data inside this SVG, so it should not replace the optimized PNG in the application.

The navbar keeps the product's accessible orange-red interface accent while using the mark's sampled red (`#E00C0F`) for its subtle hover glow.
