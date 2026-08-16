import type { AccountStatus } from "@fightlobby/domain";

import { ApiError } from "./http";

export function assertMutationAllowed(accountStatus: AccountStatus) {
  if (["suspended", "banned", "deleted"].includes(accountStatus)) {
    throw new ApiError(
      "This account cannot make changes",
      403,
      `account_${accountStatus}`,
    );
  }
}
