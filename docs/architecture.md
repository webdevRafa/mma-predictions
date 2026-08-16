# Architecture

FightLobby is a pnpm monorepo with a Next.js App Router frontend, Firebase Functions v2 backend, and shared strict TypeScript domain package.

Public product data will live in Firestore. Realtime chat and presence will live in Realtime Database. Browser code may read permitted public data, but all canonical mutations flow through server-authoritative functions or route handlers.

Development and tests use normalized UFC-only fixtures through a mock provider. Production data must be mapped through the provider interface; provider response types may not leak into UI components.

The production pipeline is documented in [ingestion.md](./ingestion.md). SportsDataIO is implemented as the first real adapter but remains runtime-gated until commercial rights and the API key are explicitly configured. Canonical IDs are resolved through provider mappings, manual overrides remain separate from source values, and server-side revalidation publishes data changes without a web deployment.
