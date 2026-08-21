# Architecture

FightLobby is a pnpm monorepo with a Next.js App Router frontend, Firebase Functions v2 backend, and shared strict TypeScript domain package.

Public product data will live in Firestore. Realtime chat and presence will live in Realtime Database. Browser code may read permitted public data, but all canonical mutations flow through server-authoritative functions or route handlers.

Development and tests use normalized UFC-only fixtures. Launch production data is supplied through the guarded, operator-reviewed JSON-to-Firestore importer; source-specific response types may not leak into UI components.

The production pipeline is documented in [ingestion.md](./ingestion.md). Every import validates canonical IDs, preserves live operational state, writes provenance and audit records, and triggers server-side revalidation without a web deployment. Automated provider adapters remain optional future infrastructure and are not a launch dependency.
