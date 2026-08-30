import type { Dispatch, RefObject, SetStateAction } from "react";
import type { PhotoKind } from "@/domain/types";
import {
  createPhotoUploadAction,
  discardPhotoUploadAction,
  finalizePhotoUploadAction,
} from "@/features/photos/actions";
import { availablePhotoSortOrders } from "@/features/photos/photo-order";
import { createClient } from "@/lib/supabase/browser";
import type { PhotoWithUrl } from "./types";
import type { PendingPhoto } from "./visit-photo-picker";

type FileHandlerConfig = {
  storedPhotos: PhotoWithUrl[];
  savingRef: RefObject<boolean>;
  preparationCountRef: RefObject<number>;
  setPhotos: Dispatch<SetStateAction<PendingPhoto[]>>;
  setPending: Dispatch<SetStateAction<boolean>>;
  setDirty: Dispatch<SetStateAction<boolean>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
};

export function createPhotoFileHandler(config: FileHandlerConfig) {
  return async (kind: PhotoKind, files: FileList | null) => {
    if (!files || config.savingRef.current) return;
    config.preparationCountRef.current += 1;
    config.setPending(true);
    config.setMessage(null);
    const limit = kind === "GENERAL" ? 10 : 3;
    try {
      const processed = await Promise.all(Array.from(files).slice(0, limit).map(processImage));
      config.setPhotos((current) =>
        appendProcessedPhotos(current, config.storedPhotos, processed, kind, limit),
      );
      config.setDirty(true);
    } catch (error) {
      config.setMessage(error instanceof Error ? error.message : "사진을 처리하지 못했습니다.");
    } finally {
      config.preparationCountRef.current -= 1;
      if (config.preparationCountRef.current === 0) config.setPending(false);
    }
  };
}

async function processImage(file: File): Promise<{ file: File; width: number; height: number }> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPEG, PNG, WebP만 업로드할 수 있습니다.");
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob || blob.size > 3 * 1024 * 1024) throw new Error("압축 후 사진 크기는 3MB 이하여야 합니다.");
    return {
      file: new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" }),
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
    element.src = url;
  });
}

function appendProcessedPhotos(
  current: PendingPhoto[],
  stored: PhotoWithUrl[],
  processed: Awaited<ReturnType<typeof processImage>>[],
  kind: PhotoKind,
  limit: number,
) {
  const available = availablePhotoSortOrders(
    [
      ...stored.filter((photo) => photo.kind === kind).map((photo) => photo.sort_order),
      ...current.filter((photo) => photo.kind === kind).map((photo) => photo.sortOrder),
    ],
    limit,
    processed.length,
  );
  const pending = processed.slice(0, available.length).map((photo, index) => ({
    id: crypto.randomUUID(),
    ...photo,
    sortOrder: available[index],
    kind,
    previewUrl: URL.createObjectURL(photo.file),
    status: "ready" as const,
  }));
  return [...current, ...pending];
}

type UploaderConfig = {
  photos: PendingPhoto[];
  setPhotos: Dispatch<SetStateAction<PendingPhoto[]>>;
  setStoredPhotos: Dispatch<SetStateAction<PhotoWithUrl[]>>;
};

export function createPhotoUploader(config: UploaderConfig) {
  return async (visitId: string) => {
    const supabase = createClient();
    let failed = 0;
    for (const photo of config.photos) {
      setPhotoStatus(config.setPhotos, photo.id, "uploading");
      const stored = await uploadPhoto({ visitId, photo, supabase });
      if (!stored) {
        failed += 1;
        setPhotoStatus(config.setPhotos, photo.id, "failed");
        continue;
      }
      URL.revokeObjectURL(photo.previewUrl);
      config.setStoredPhotos((current) =>
        [...current, stored].sort((a, b) => (a.kind === b.kind ? a.sort_order - b.sort_order : 0)),
      );
      config.setPhotos((current) => current.filter((item) => item.id !== photo.id));
    }
    return failed;
  };
}

type UploadPhotoConfig = {
  visitId: string;
  photo: PendingPhoto;
  supabase: ReturnType<typeof createClient>;
};

async function uploadPhoto({ visitId, photo, supabase }: UploadPhotoConfig) {
  const prepared = await createPhotoUploadAction({
    visitId,
    kind: photo.kind,
    mimeType: photo.file.type as "image/webp",
    sizeBytes: photo.file.size,
  });
  if (!prepared.ok) return null;
  const upload = await supabase.storage
    .from("cafe-photos")
    .uploadToSignedUrl(prepared.data.path, prepared.data.token, photo.file, {
      contentType: photo.file.type,
      upsert: false,
    });
  if (upload.error) {
    await discardPhotoUploadAction(visitId, prepared.data.path);
    return null;
  }
  const finalized = await finalizePhotoUploadAction({
    visitId,
    kind: photo.kind,
    mimeType: photo.file.type as "image/webp",
    sizeBytes: photo.file.size,
    path: prepared.data.path,
    width: photo.width,
    height: photo.height,
    sortOrder: photo.sortOrder,
  });
  return finalized.ok ? finalized.data : null;
}

function setPhotoStatus(
  setPhotos: Dispatch<SetStateAction<PendingPhoto[]>>,
  id: string,
  status: PendingPhoto["status"],
) {
  setPhotos((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
}
