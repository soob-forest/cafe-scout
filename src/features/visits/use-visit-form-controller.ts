"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { estimateBusiness, STAY_MINUTES } from "@/domain/business-estimator";
import type { CafeOption, VisitInput } from "@/domain/types";
import type { PhotoWithUrl } from "./types";
import { saveVisitAction } from "./actions";
import { useVisitPhotos } from "./use-visit-photos";
import { focusValidationError } from "./visit-form-focus";
import type { VisitFormModel, VisitFormUpdate } from "./visit-form-context";

export type VisitFormControllerProps = {
  initial: VisitInput;
  cafes: CafeOption[];
  visitId?: string;
  existingPhotos?: PhotoWithUrl[];
};

export function useVisitFormController({
  initial,
  cafes,
  visitId,
  existingPhotos = [],
}: VisitFormControllerProps) {
  const router = useRouter();
  const core = useVisitCoreState(initial, cafes, visitId);
  const photoModel = useVisitPhotos({
    initialPhotos: existingPhotos,
    savedVisitId: core.savedVisitId,
    savingRef: core.savingRef,
    setDirty: core.setDirty,
    setMessage: core.setMessage,
  });
  const estimate = useVisitEstimate(core.form);
  const actions = createFormActions(core);
  const shouldWarn = core.dirty || photoModel.photoPreparationPending || core.saving;
  useVisitLeaveWarning(shouldWarn);
  const submit = createSubmitHandler({ core, photoModel, router });
  const errorFor = (key: string) => core.fieldErrors[key]?.[0];
  const fieldId = (key: string) => `visit-${key}`;
  const errorDescriptionId = (key: string) => (errorFor(key) ? `${fieldId(key)}-error` : undefined);
  const model: VisitFormModel = {
    form: core.form,
    cafeOptions: core.cafeOptions,
    estimate,
    saving: core.saving,
    message: core.message,
    errorFor,
    fieldId,
    errorDescriptionId,
    ...actions,
    ...photoModel,
  };
  return { model, submit, fieldErrors: core.fieldErrors, errorSummaryRef: core.errorSummaryRef };
}

function useVisitCoreState(initial: VisitInput, cafes: CafeOption[], visitId?: string) {
  const [form, setForm] = useState(initial);
  const [cafeOptions, setCafeOptions] = useState(cafes);
  const [dirty, setDirty] = useState(false);
  const [coreDirty, setCoreDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedVisitId, setSavedVisitId] = useState(visitId ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const createRequestIdRef = useRef<string | null>(null);
  return {
    form,
    setForm,
    cafeOptions,
    setCafeOptions,
    dirty,
    setDirty,
    coreDirty,
    setCoreDirty,
    saving,
    setSaving,
    savedVisitId,
    setSavedVisitId,
    message,
    setMessage,
    fieldErrors,
    setFieldErrors,
    errorSummaryRef,
    savingRef,
    createRequestIdRef,
  };
}

type CoreState = ReturnType<typeof useVisitCoreState>;
type PhotoModel = ReturnType<typeof useVisitPhotos>;

function useVisitEstimate(form: VisitInput) {
  const averageStayMinutes = form.averageStayPreset ? STAY_MINUTES[form.averageStayPreset] : null;
  return useMemo(
    () =>
      estimateBusiness({
        seatCount: form.seatCount,
        currentCustomers: form.currentCustomers,
        occupancyRate: form.currentCustomers !== null ? null : form.occupancyRate,
        averageStayMinutes,
        estimatedAverageSpend: form.estimatedAverageSpend,
        openTime: form.openTime,
        closeTime: form.closeTime,
        operatingDaysPerMonth: form.operatingDaysPerMonth,
        takeoutLevel: form.takeoutLevel,
        observedTakeoutOrders: form.observedTakeoutOrders,
        observationDurationMinutes: form.observationDurationMinutes,
      }),
    [form, averageStayMinutes],
  );
}

function useVisitLeaveWarning(shouldWarn: boolean) {
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (shouldWarn) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [shouldWarn]);
  useEffect(() => {
    if (!shouldWarn) return;
    const guard = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || new URL(anchor.href).origin !== window.location.origin)
        return;
      if (!window.confirm("저장하지 않은 변경사항이 있습니다. 페이지를 나갈까요?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, [shouldWarn]);
}

function createFormActions(core: CoreState) {
  const update: VisitFormUpdate = (key, value) => {
    core.setForm((current) => ({ ...current, [key]: value }));
    core.setDirty(true);
    core.setCoreDirty(true);
  };
  const chooseCafe = (id: string) => {
    const cafe = core.cafeOptions.find((item) => item.id === id);
    update("cafeId", id || null);
    if (cafe)
      core.setForm((current) => ({
        ...current,
        openTime: cafe.latestOpenTime,
        closeTime: cafe.latestCloseTime,
      }));
  };
  const addMenu = () =>
    update("representativeMenus", [
      ...core.form.representativeMenus,
      {
        name: "",
        category: "COFFEE",
        price: 0,
        isSignature: false,
        sortOrder: core.form.representativeMenus.length,
      },
    ]);
  const updateMenu = (index: number, patch: Partial<VisitInput["representativeMenus"][number]>) =>
    update(
      "representativeMenus",
      core.form.representativeMenus.map((menu, itemIndex) =>
        itemIndex === index ? { ...menu, ...patch } : menu,
      ),
    );
  const removeMenu = (index: number) =>
    update(
      "representativeMenus",
      core.form.representativeMenus
        .filter((_, itemIndex) => itemIndex !== index)
        .map((menu, sortOrder) => ({ ...menu, sortOrder })),
    );
  const moveMenu = (index: number, direction: -1 | 1) => {
    const items = moveMenuItems(core.form.representativeMenus, index, direction);
    if (items) update("representativeMenus", items);
  };
  return { update, chooseCafe, addMenu, updateMenu, removeMenu, moveMenu };
}

function moveMenuItems(items: VisitInput["representativeMenus"], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return null;
  const reordered = [...items];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  return reordered.map((menu, sortOrder) => ({ ...menu, sortOrder }));
}

type SubmitConfig = {
  core: CoreState;
  photoModel: PhotoModel;
  router: ReturnType<typeof useRouter>;
};

function createSubmitHandler(config: SubmitConfig) {
  return async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitBlocked(config)) return;
    startSaving(config.core);
    try {
      const visitId = await saveVisitCore(config.core);
      if (!visitId) return;
      const failed = await config.photoModel.uploadPhotos(visitId);
      if (failed) return reportPhotoFailures(config.core, failed);
      config.core.setDirty(false);
      config.router.push(`/visits/${visitId}`);
      config.router.refresh();
    } catch {
      config.core.setMessage("저장 중 연결이 끊겼습니다. 다시 저장해 주세요.");
      config.core.setDirty(true);
    } finally {
      config.core.savingRef.current = false;
      config.core.setSaving(false);
    }
  };
}

function isSubmitBlocked({ core, photoModel }: SubmitConfig) {
  return (
    core.savingRef.current ||
    photoModel.photoPreparationCountRef.current > 0 ||
    photoModel.photoMutationRef.current
  );
}

function startSaving(core: CoreState) {
  core.savingRef.current = true;
  core.setSaving(true);
  core.setMessage(null);
  core.setFieldErrors({});
}

async function saveVisitCore(core: CoreState): Promise<string | null> {
  const result = await persistVisit(core);
  if (!result.ok) {
    core.setMessage(result.error);
    core.setFieldErrors(result.fieldErrors ?? {});
    focusValidationError(Object.keys(result.fieldErrors ?? {})[0], core.errorSummaryRef);
    return null;
  }
  core.setSavedVisitId(result.data.id);
  core.setCoreDirty(false);
  if (result.data.cafe && core.form.cafeSelectionMode === "NEW") syncSavedCafe(core, result.data.cafe);
  return result.data.id;
}

function persistVisit(core: CoreState) {
  if (core.savedVisitId && !core.coreDirty)
    return Promise.resolve({ ok: true as const, data: { id: core.savedVisitId, cafe: null } });
  const requestId = core.savedVisitId ? undefined : (core.createRequestIdRef.current ??= crypto.randomUUID());
  return saveVisitAction(core.form, core.savedVisitId ?? undefined, requestId);
}

function syncSavedCafe(core: CoreState, cafe: { id: string; name: string; region: string }) {
  const savedCafe = {
    ...cafe,
    latestOpenTime: core.form.openTime,
    latestCloseTime: core.form.closeTime,
  };
  core.setCafeOptions((current) =>
    current.some((item) => item.id === savedCafe.id) ? current : [...current, savedCafe],
  );
  core.setForm((current) => ({
    ...current,
    cafeSelectionMode: "EXISTING",
    cafeId: savedCafe.id,
    cafeName: null,
    region: null,
  }));
}

function reportPhotoFailures(core: CoreState, failed: number) {
  core.setMessage(`기록은 저장됐지만 사진 ${failed}장을 올리지 못했습니다. 다시 저장하면 재시도합니다.`);
  core.setDirty(true);
}
