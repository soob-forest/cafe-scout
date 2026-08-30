"use client";

import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { CafeOption, EstimationResult, PhotoKind, VisitInput } from "@/domain/types";
import type { PhotoWithUrl } from "./types";
import type { PendingPhoto } from "./visit-photo-picker";

export type VisitFormUpdate = <Key extends keyof VisitInput>(key: Key, value: VisitInput[Key]) => void;

export type VisitFormModel = {
  form: VisitInput;
  cafeOptions: CafeOption[];
  photos: PendingPhoto[];
  storedPhotos: PhotoWithUrl[];
  estimate: EstimationResult;
  saving: boolean;
  photoPreparationPending: boolean;
  photoMutationPending: boolean;
  message: string | null;
  update: VisitFormUpdate;
  chooseCafe: (id: string) => void;
  addMenu: () => void;
  updateMenu: (index: number, patch: Partial<VisitInput["representativeMenus"][number]>) => void;
  removeMenu: (index: number) => void;
  moveMenu: (index: number, direction: -1 | 1) => void;
  setPhotos: Dispatch<SetStateAction<PendingPhoto[]>>;
  onFiles: (kind: PhotoKind, files: FileList | null) => Promise<void>;
  removeStored: (photo: PhotoWithUrl) => Promise<void>;
  moveStored: (photo: PhotoWithUrl, direction: -1 | 1) => Promise<void>;
  errorFor: (key: string) => string | undefined;
  fieldId: (key: string) => string;
  errorDescriptionId: (key: string) => string | undefined;
};

const VisitFormContext = createContext<VisitFormModel | null>(null);

export const VisitFormProvider = VisitFormContext.Provider;

export function useVisitForm(): VisitFormModel {
  const model = useContext(VisitFormContext);
  if (!model) throw new Error("VisitFormProvider 내부에서만 폼 섹션을 사용할 수 있습니다.");
  return model;
}
