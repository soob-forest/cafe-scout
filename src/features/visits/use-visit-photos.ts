import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { removePhotoAction, reorderPhotosAction } from "@/features/photos/actions";
import type { PhotoWithUrl } from "./types";
import { createPhotoFileHandler, createPhotoUploader } from "./visit-photo-processing";
import type { PendingPhoto } from "./visit-photo-picker";

type Config = {
  initialPhotos: PhotoWithUrl[];
  savedVisitId: string | null;
  savingRef: RefObject<boolean>;
  setDirty: Dispatch<SetStateAction<boolean>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
};

export function useVisitPhotos(config: Config) {
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [storedPhotos, setStoredPhotos] = useState(config.initialPhotos);
  const [photoPreparationPending, setPhotoPreparationPending] = useState(false);
  const [photoMutationPending, setPhotoMutationPending] = useState(false);
  const photosRef = useRef(photos);
  const photoPreparationCountRef = useRef(0);
  const photoMutationRef = useRef(false);
  usePhotoPreviewCleanup(photos, photosRef);
  const mutationConfig = {
    ...config,
    storedPhotos,
    setStoredPhotos,
    setPending: setPhotoMutationPending,
    mutationRef: photoMutationRef,
  };
  const onFiles = (...args: Parameters<ReturnType<typeof createPhotoFileHandler>>) =>
    createPhotoFileHandler({
      ...config,
      storedPhotos,
      preparationCountRef: photoPreparationCountRef,
      setPhotos,
      setPending: setPhotoPreparationPending,
    })(...args);
  const removeStored = (photo: PhotoWithUrl) => createStoredPhotoRemover(mutationConfig)(photo);
  const moveStored = (photo: PhotoWithUrl, direction: -1 | 1) =>
    createStoredPhotoMover(mutationConfig)(photo, direction);
  return {
    photos,
    storedPhotos,
    setPhotos,
    photoPreparationPending,
    photoMutationPending,
    photoPreparationCountRef,
    photoMutationRef,
    onFiles,
    uploadPhotos: createPhotoUploader({ photos, setPhotos, setStoredPhotos }),
    removeStored,
    moveStored,
  };
}

function usePhotoPreviewCleanup(photos: PendingPhoto[], photosRef: RefObject<PendingPhoto[]>) {
  useEffect(() => {
    photosRef.current = photos;
  }, [photos, photosRef]);
  useEffect(
    () => () => photosRef.current?.forEach((photo) => URL.revokeObjectURL(photo.previewUrl)),
    [photosRef],
  );
}

type MutationConfig = Config & {
  storedPhotos: PhotoWithUrl[];
  setStoredPhotos: Dispatch<SetStateAction<PhotoWithUrl[]>>;
  setPending: Dispatch<SetStateAction<boolean>>;
  mutationRef: RefObject<boolean>;
};

function createStoredPhotoRemover(config: MutationConfig) {
  return async (photo: PhotoWithUrl) => {
    if (mutationBlocked(config)) return;
    beginMutation(config);
    try {
      const result = await removePhotoAction(photo.id, config.savedVisitId!);
      if (!result.ok) return config.setMessage(result.error);
      config.setStoredPhotos((current) => current.filter((item) => item.id !== photo.id));
      if (result.data.cleanupPending)
        config.setMessage(
          "사진 정보는 제거됐지만 Storage 정리가 지연됐습니다. 운영 점검에서 고아 사진을 정리해 주세요.",
        );
    } catch {
      config.setMessage("사진을 제거하지 못했습니다.");
    } finally {
      endMutation(config);
    }
  };
}

function createStoredPhotoMover(config: MutationConfig) {
  return async (photo: PhotoWithUrl, direction: -1 | 1) => {
    if (mutationBlocked(config)) return;
    const reordered = reorderStoredPhotos(config.storedPhotos, photo, direction);
    if (!reordered) return;
    beginMutation(config);
    config.setStoredPhotos(reordered.all);
    try {
      const result = await reorderPhotosAction(
        config.savedVisitId!,
        photo.kind,
        reordered.kindPhotos.map((item) => item.id),
      );
      if (!result.ok) {
        config.setStoredPhotos(config.storedPhotos);
        config.setMessage(result.error);
      }
    } catch {
      config.setStoredPhotos(config.storedPhotos);
      config.setMessage("사진 순서를 변경하지 못했습니다.");
    } finally {
      endMutation(config);
    }
  };
}

function mutationBlocked(config: MutationConfig) {
  return !config.savedVisitId || config.savingRef.current || config.mutationRef.current;
}

function beginMutation(config: MutationConfig) {
  config.mutationRef.current = true;
  config.setPending(true);
}

function endMutation(config: MutationConfig) {
  config.mutationRef.current = false;
  config.setPending(false);
}

function reorderStoredPhotos(stored: PhotoWithUrl[], photo: PhotoWithUrl, direction: -1 | 1) {
  const kindPhotos = stored.filter((item) => item.kind === photo.kind);
  const index = kindPhotos.findIndex((item) => item.id === photo.id);
  const target = index + direction;
  if (target < 0 || target >= kindPhotos.length) return null;
  [kindPhotos[index], kindPhotos[target]] = [kindPhotos[target], kindPhotos[index]];
  let cursor = 0;
  const all = stored.map((item) =>
    item.kind === photo.kind ? { ...kindPhotos[cursor], sort_order: cursor++ } : item,
  );
  return { all, kindPhotos };
}
