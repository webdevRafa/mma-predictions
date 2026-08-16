import { z } from "zod";

export const RESERVED_HANDLES = new Set([
  "admin",
  "administrator",
  "api",
  "events",
  "fighters",
  "fightlobby",
  "fights",
  "help",
  "leaderboards",
  "login",
  "mod",
  "moderator",
  "official",
  "settings",
  "signup",
  "support",
  "ufc",
  "zuffa",
]);

export function normalizeHandle(value: string) {
  return value.trim().toLowerCase();
}

export const handleSchema = z
  .string()
  .transform(normalizeHandle)
  .pipe(
    z
      .string()
      .min(3, "Handle must be at least 3 characters")
      .max(20, "Handle must be at most 20 characters")
      .regex(
        /^[a-z0-9][a-z0-9_]*$/,
        "Use letters, numbers, and underscores; start with a letter or number",
      )
      .refine(
        (handle) => !handle.includes("__"),
        "Handle cannot contain consecutive underscores",
      )
      .refine(
        (handle) => !RESERVED_HANDLES.has(handle),
        "That handle is reserved",
      ),
  );
