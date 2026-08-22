export interface AvatarSaveResponse {
  photoURL: string;
  version?: number;
}

class NonRetryableAvatarError extends Error {}

export function readAvatarApiError(payload: unknown, fallback: string) {
  return typeof payload === "object" &&
    payload &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error &&
    "message" in payload.error
    ? String(payload.error.message)
    : fallback;
}

function isAvatarSaveResponse(payload: unknown): payload is AvatarSaveResponse {
  return Boolean(
    payload &&
    typeof payload === "object" &&
    "photoURL" in payload &&
    typeof payload.photoURL === "string",
  );
}

export async function confirmAvatarSave(
  request: () => Promise<Response>,
  options: { attempts?: number; retryDelayMs?: number } = {},
) {
  const attempts = Math.max(1, options.attempts ?? 2);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 250);
  let lastError: Error = new Error("Photo could not be saved");

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await request();
      const payload: unknown = await response.json().catch(() => null);
      if (response.ok && isAvatarSaveResponse(payload)) return payload;

      const error = new Error(
        readAvatarApiError(payload, "Photo could not be saved"),
      );
      if (response.status < 500)
        throw new NonRetryableAvatarError(error.message);
      lastError = error;
    } catch (caught) {
      if (caught instanceof NonRetryableAvatarError) throw caught;
      lastError =
        caught instanceof Error
          ? caught
          : new Error("Photo could not be saved");
    }

    if (attempt + 1 < attempts && retryDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw lastError;
}
