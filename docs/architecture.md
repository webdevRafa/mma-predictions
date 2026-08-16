# Architecture

FightLobby is a pnpm monorepo with a Next.js App Router frontend, Firebase Functions v2 backend, and shared strict TypeScript domain package.

Public product data will live in Firestore. Realtime chat and presence will live in Realtime Database. Browser code may read permitted public data, but all canonical mutations flow through server-authoritative functions or route handlers.

Development and tests use normalized UFC-only fixtures through a mock provider. Production data must be mapped through the provider interface; provider response types may not leak into UI components.
