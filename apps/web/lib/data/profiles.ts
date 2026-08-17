import "server-only";

import { cache } from "react";

import { getProfileRepository } from "@/lib/repositories/profiles";

export const listPublicProfiles = cache(() =>
  getProfileRepository().listProfiles(),
);

export const getPublicProfile = cache((handle: string) =>
  getProfileRepository().getByHandle(handle),
);
