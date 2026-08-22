"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import {
  ref as storageRef,
  uploadBytesResumable,
  type UploadTaskSnapshot,
} from "firebase/storage";
import {
  Camera,
  Check,
  CircleUserRound,
  ImagePlus,
  LoaderCircle,
  Trash2,
  X,
} from "lucide-react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  AVATAR_CONTENT_TYPE,
  AVATAR_MAX_SOURCE_BYTES,
  AVATAR_OUTPUT_SIZE,
  avatarStoragePath,
} from "@/lib/auth/avatar";
import {
  confirmAvatarSave,
  readAvatarApiError,
} from "@/lib/auth/avatar-confirmation";
import { dispatchAuthProfileUpdated } from "@/lib/auth/client-profile-events";
import {
  getFirebaseAppCheckToken,
  getFirebaseClient,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";

const ACCEPTED_SOURCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function loadImage(source: string) {
  const image = new Image();
  image.decoding = "async";
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That image could not be opened"));
  });
  image.src = source;
  return loaded;
}

async function createCroppedAvatar(source: string, crop: Area) {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare the image");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    AVATAR_OUTPUT_SIZE,
    AVATAR_OUTPUT_SIZE,
  );
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, AVATAR_CONTENT_TYPE, 0.9),
  );
  if (!blob || blob.type !== AVATAR_CONTENT_TYPE) {
    throw new Error("Your browser could not save this image as WebP");
  }
  return blob;
}

function uploadAvatar(
  path: ReturnType<typeof storageRef>,
  avatar: Blob,
  onProgress: (progress: number) => void,
) {
  const upload = uploadBytesResumable(path, avatar, {
    cacheControl: "public,max-age=31536000",
    contentType: AVATAR_CONTENT_TYPE,
  });
  return new Promise<UploadTaskSnapshot>((resolve, reject) => {
    upload.on(
      "state_changed",
      (snapshot) => {
        const progress =
          snapshot.totalBytes > 0
            ? Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
              )
            : 0;
        onProgress(progress);
      },
      reject,
      () => resolve(upload.snapshot),
    );
  });
}

type SaveStage = "preparing" | "uploading" | "confirming" | "saved";

function saveStageMessage(stage: SaveStage, uploadProgress: number) {
  if (stage === "preparing") return "Preparing your cropped photo…";
  if (stage === "uploading") return `Uploading your photo… ${uploadProgress}%`;
  if (stage === "confirming") return "Confirming your profile photo…";
  return "Photo saved. Updating your profile…";
}

export function AvatarEditor() {
  const fileInput = useRef<HTMLInputElement>(null);
  const cropDialog = useRef<HTMLDialogElement>(null);
  const [user, setUser] = useState<User | null | undefined>(() =>
    isFirebaseClientConfigured ? undefined : null,
  );
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState<"saving" | "removing" | null>(null);
  const [saveStage, setSaveStage] = useState<SaveStage | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseClientConfigured) return;
    return onAuthStateChanged(
      getFirebaseClient().auth,
      (currentUser) => {
        setUser(currentUser);
        setPhotoURL(currentUser?.photoURL ?? null);
        setImageFailed(false);
      },
      () => setUser(null),
    );
  }, []);

  useEffect(() => {
    if (source && !cropDialog.current?.open) cropDialog.current?.showModal();
  }, [source]);

  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source);
    },
    [source],
  );

  function discardCrop() {
    cropDialog.current?.close();
    setSource(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setSaveStage(null);
    setUploadProgress(0);
    if (fileInput.current) fileInput.current.value = "";
  }

  function chooseSource(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setStatus(null);
    setSaveStage(null);
    setUploadProgress(0);
    if (!ACCEPTED_SOURCE_TYPES.has(file.type)) {
      event.target.value = "";
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > AVATAR_MAX_SOURCE_BYTES) {
      event.target.value = "";
      setError("Choose an image smaller than 10 MB.");
      return;
    }
    setSource(URL.createObjectURL(file));
  }

  async function saveCrop() {
    if (!source || !croppedArea || !user) return;
    setBusy("saving");
    setSaveStage("preparing");
    setUploadProgress(0);
    setError(null);
    setStatus(null);
    try {
      const avatar = await createCroppedAvatar(source, croppedArea);
      const client = getFirebaseClient();
      setSaveStage("uploading");
      await uploadAvatar(
        storageRef(client.storage, avatarStoragePath(user.uid)),
        avatar,
        setUploadProgress,
      );
      setSaveStage("confirming");
      const appCheckToken = await getFirebaseAppCheckToken();
      const payload = await confirmAvatarSave(() =>
        fetch("/api/profile/avatar", {
          method: "POST",
          headers: {
            Accept: "application/json",
            ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {}),
          },
        }),
      );
      setPhotoURL(payload.photoURL);
      setImageFailed(false);
      dispatchAuthProfileUpdated({ photoURL: payload.photoURL });
      setStatus("Profile photo saved.");
      setSaveStage("saved");
      void user.reload().catch(() => undefined);
      await new Promise((resolve) => window.setTimeout(resolve, 600));
      discardCrop();
    } catch (caught) {
      setSaveStage(null);
      setError(
        caught instanceof Error ? caught.message : "Photo could not be saved",
      );
    } finally {
      setBusy(null);
    }
  }

  async function removePhoto() {
    if (!user) return;
    setBusy("removing");
    setError(null);
    setStatus(null);
    try {
      const appCheckToken = await getFirebaseAppCheckToken();
      const response = await fetch("/api/profile/avatar", {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {}),
        },
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          readAvatarApiError(payload, "Photo could not be removed"),
        );
      }
      setPhotoURL(null);
      setImageFailed(false);
      dispatchAuthProfileUpdated({ photoURL: null });
      setStatus("Profile photo removed.");
      void user.reload().catch(() => undefined);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Photo could not be removed",
      );
    } finally {
      setBusy(null);
    }
  }

  if (user === undefined) {
    return (
      <div
        aria-busy="true"
        className="flex items-center gap-4 rounded-xl border border-fl-border bg-fl-surface-2/50 p-4"
        role="status"
      >
        <span className="sr-only">Loading your profile photo…</span>
        <Skeleton className="size-20 shrink-0 rounded-full" />
        <span className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-full max-w-sm" />
          <Skeleton className="h-9 w-28" />
        </span>
      </div>
    );
  }

  return (
    <section
      aria-busy={busy !== null}
      aria-labelledby="avatar-editor-title"
      className="rounded-xl border border-fl-border bg-fl-surface-2/50 p-4"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative mx-auto size-24 shrink-0 sm:mx-0">
          <span className="grid size-24 place-items-center overflow-hidden rounded-full border border-fl-border bg-fl-surface-3 text-fl-text-dim">
            {photoURL && !imageFailed ? (
              // Firebase Auth photo URLs can come from Google or FightLobby Storage.
              <img
                alt="Your profile avatar"
                className="size-full object-cover"
                onError={() => setImageFailed(true)}
                referrerPolicy="no-referrer"
                src={photoURL}
              />
            ) : (
              <CircleUserRound aria-hidden="true" size={38} />
            )}
          </span>
          {user ? (
            <button
              aria-label={
                photoURL ? "Change profile photo" : "Add profile photo"
              }
              className="focus-ring absolute right-0 bottom-0 grid size-9 cursor-pointer place-items-center rounded-full border border-fl-border bg-fl-accent text-fl-bg shadow-lg hover:bg-fl-accent-strong"
              disabled={busy !== null}
              onClick={() => fileInput.current?.click()}
              type="button"
            >
              <Camera aria-hidden="true" size={16} />
            </button>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h3 className="text-sm font-bold" id="avatar-editor-title">
            Profile photo <span className="text-fl-text-dim">(optional)</span>
          </h3>
          <p className="mt-1 text-xs leading-5 text-fl-text-muted">
            {photoURL
              ? "Use your current account photo, replace it with a cropped upload, or remove it at any time."
              : "Add a photo so signed-in status and your community identity are easier to recognize."}
          </p>
          {user ? (
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <button
                className="focus-ring inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-fl-border bg-fl-surface-1 px-3 text-xs font-bold hover:border-fl-text-muted disabled:cursor-wait disabled:opacity-60"
                disabled={busy !== null}
                onClick={() => fileInput.current?.click()}
                type="button"
              >
                <ImagePlus aria-hidden="true" size={14} />
                {photoURL ? "Replace photo" : "Choose photo"}
              </button>
              {photoURL ? (
                <button
                  className="focus-ring inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-xs font-bold text-fl-danger hover:bg-fl-danger/10 disabled:cursor-wait disabled:opacity-60"
                  disabled={busy !== null}
                  onClick={removePhoto}
                  type="button"
                >
                  {busy === "removing" ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="animate-spin"
                      size={14}
                    />
                  ) : (
                    <Trash2 aria-hidden="true" size={14} />
                  )}
                  {busy === "removing" ? "Removing…" : "Remove"}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs font-semibold text-fl-warning">
              Sign in again to manage your profile photo.
            </p>
          )}
        </div>
      </div>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={chooseSource}
        ref={fileInput}
        tabIndex={-1}
        type="file"
      />
      {error && !source ? (
        <p
          className="mt-4 rounded-lg border border-fl-danger/30 bg-fl-danger/10 p-3 text-xs text-fl-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="mt-4 text-xs font-semibold text-fl-success" role="status">
          {status}
        </p>
      ) : null}

      <dialog
        aria-labelledby="avatar-crop-title"
        className="m-auto hidden h-[min(calc(100dvh-1.25rem),42rem)] w-[min(calc(100%-1.25rem),42rem)] flex-col overflow-hidden rounded-2xl border border-fl-border bg-fl-surface-1 p-0 text-fl-text shadow-2xl open:flex"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else discardCrop();
        }}
        ref={cropDialog}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-fl-border px-5 py-4">
          <div>
            <p className="eyebrow">Profile photo</p>
            <h2
              className="mt-1 font-display text-2xl font-bold"
              id="avatar-crop-title"
            >
              Crop your photo
            </h2>
          </div>
          <button
            aria-label="Discard photo changes"
            className="focus-ring grid size-10 cursor-pointer place-items-center rounded-lg border border-fl-border text-fl-text-muted hover:text-fl-text disabled:opacity-40"
            disabled={busy !== null}
            onClick={discardCrop}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="relative min-h-48 flex-1 bg-black">
          {source ? (
            <Cropper
              aspect={1}
              crop={crop}
              cropShape="round"
              image={source}
              onCropChange={setCrop}
              onCropComplete={(_, pixels) => setCroppedArea(pixels)}
              onZoomChange={setZoom}
              showGrid={false}
              zoom={zoom}
            />
          ) : null}
        </div>
        <div className="shrink-0 space-y-4 overflow-y-auto border-t border-fl-border p-5">
          <label className="block text-xs font-bold text-fl-text-muted">
            Zoom
            <input
              aria-label="Photo zoom"
              className="mt-2 w-full accent-fl-accent"
              disabled={busy !== null}
              max="3"
              min="1"
              onChange={(event) => setZoom(Number(event.target.value))}
              step="0.01"
              type="range"
              value={zoom}
            />
          </label>
          <p className="text-xs leading-5 text-fl-text-dim">
            Only the cropped 512 × 512 image is uploaded. The original file
            stays on your device.
          </p>
          {saveStage ? (
            <p
              className={`flex items-center gap-2 rounded-lg border p-3 text-xs font-semibold ${saveStage === "saved" ? "border-fl-success/30 bg-fl-success/10 text-fl-success" : "border-fl-border bg-fl-bg text-fl-text-muted"}`}
              role="status"
            >
              {saveStage === "saved" ? (
                <Check aria-hidden="true" className="shrink-0" size={15} />
              ) : (
                <LoaderCircle
                  aria-hidden="true"
                  className="shrink-0 animate-spin"
                  size={15}
                />
              )}
              {saveStageMessage(saveStage, uploadProgress)}
            </p>
          ) : null}
          {error && source ? (
            <p
              className="rounded-lg border border-fl-danger/30 bg-fl-danger/10 p-3 text-xs text-fl-danger"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="focus-ring min-h-11 cursor-pointer rounded-lg border border-fl-border px-4 text-sm font-bold hover:border-fl-text-muted disabled:opacity-40"
              disabled={busy !== null}
              onClick={discardCrop}
              type="button"
            >
              Discard
            </button>
            <button
              className="focus-ring inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-fl-accent px-5 text-sm font-bold text-fl-bg hover:bg-fl-accent-strong disabled:cursor-wait disabled:bg-fl-surface-3 disabled:text-fl-text-dim"
              disabled={!croppedArea || busy !== null}
              onClick={saveCrop}
              type="button"
            >
              {saveStage === "saved" ? (
                <Check aria-hidden="true" size={16} />
              ) : busy === "saving" ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="animate-spin"
                  size={16}
                />
              ) : null}
              {saveStage === "saved"
                ? "Saved"
                : busy === "saving"
                  ? "Saving photo…"
                  : "Save photo"}
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
