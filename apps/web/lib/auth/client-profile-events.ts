export const AUTH_PROFILE_UPDATED_EVENT = "fightlobby:auth-profile-updated";

export interface AuthProfileUpdatedDetail {
  handle?: string | null;
  photoURL?: string | null;
}

export function dispatchAuthProfileUpdated(detail: AuthProfileUpdatedDetail) {
  window.dispatchEvent(
    new CustomEvent<AuthProfileUpdatedDetail>(AUTH_PROFILE_UPDATED_EVENT, {
      detail,
    }),
  );
}
