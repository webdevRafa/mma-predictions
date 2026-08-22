import { ApiError } from "./http";

export const AVATAR_OUTPUT_SIZE = 512;
export const AVATAR_MAX_BYTES = 1024 * 1024;
export const AVATAR_MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const AVATAR_CONTENT_TYPE = "image/webp";

export function avatarStoragePath(uid: string) {
  return `avatars/${uid}/avatar.webp`;
}

export function assertAvatarMetadata(metadata: {
  contentType?: string | undefined;
  size?: number | string | undefined;
}) {
  if (metadata.contentType !== AVATAR_CONTENT_TYPE) {
    throw new ApiError(
      "Avatar must be a WebP image",
      400,
      "invalid_avatar_type",
    );
  }
  const size = Number(metadata.size);
  if (!Number.isFinite(size) || size <= 0 || size > AVATAR_MAX_BYTES) {
    throw new ApiError(
      "Avatar must be smaller than 1 MB",
      400,
      "invalid_avatar_size",
    );
  }
}

export function nextAvatarVersion(value: unknown) {
  if (!value || typeof value !== "object" || !("version" in value)) return 1;
  const version = Number(value.version);
  return Number.isSafeInteger(version) && version >= 0 ? version + 1 : 1;
}
