export const AUTH_PROFILE_UPDATED_EVENT = "fightlobby:auth-profile-updated";

export interface AuthProfileUpdatedDetail {
  photoURL: string | null;
}

export function dispatchAuthProfileUpdated(photoURL: string | null) {
  window.dispatchEvent(
    new CustomEvent<AuthProfileUpdatedDetail>(AUTH_PROFILE_UPDATED_EVENT, {
      detail: { photoURL },
    }),
  );
}
