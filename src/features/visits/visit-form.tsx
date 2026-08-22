"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Camera, Check, ImagePlus, Minus, Plus, Save, Trash2 } from "lucide-react";
import {
  CUSTOMER_TYPES,
  MENU_CATEGORIES,
  MOOD_TAGS,
  PRICE_LEVELS,
  STAY_PRESETS,
  TAKEOUT_LEVELS,
  VISIT_PURPOSES,
  type CafeOption,
  type PhotoKind,
  type VisitInput,
} from "@/domain/types";
import { estimateBusiness, STAY_MINUTES } from "@/domain/business-estimator";
import { confidenceDots, formatCompactKrw, formatKrw, formatNumber } from "@/lib/format";
import { saveVisitAction } from "./actions";
import {
  createPhotoUploadAction,
  discardPhotoUploadAction,
  finalizePhotoUploadAction,
  removePhotoAction,
  reorderPhotosAction,
} from "@/features/photos/actions";
import { createClient } from "@/lib/supabase/browser";
import type { PhotoWithUrl } from "./types";
import { availablePhotoSortOrders, swapPendingPhotoOrder } from "@/features/photos/photo-order";
import { seoulLocalDateTimeToIso, toSeoulLocalDateTime } from "@/lib/seoul-datetime";
import { VISIT_FIELD_LABELS } from "@/lib/validation/visit";

type PendingPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  kind: PhotoKind;
  width: number;
  height: number;
  sortOrder: number;
  status: "ready" | "uploading" | "failed";
};

const LABELS = {
  price: { CHEAP: "저렴", NORMAL: "보통", HIGH: "높은 편", VERY_HIGH: "매우 높음" },
  stay: {
    UNDER_30M: "30분 이하",
    ONE_HOUR: "1시간",
    ONE_HALF_HOUR: "1.5시간",
    TWO_HOURS: "2시간",
    OVER_TWO_HOURS: "2시간+",
  },
  takeout: { NONE: "거의 없음", LOW: "조금 있음", MEDIUM: "많음", HIGH: "매우 많음" },
  category: {
    COFFEE: "커피",
    NON_COFFEE: "논커피",
    DESSERT: "디저트",
    BAKERY: "베이커리",
    BRUNCH: "브런치",
    ETC: "기타",
  },
} as const;

function numberOrNull(value: string) {
  return value === "" ? null : Number(value);
}

async function processImage(file: File): Promise<{ file: File; width: number; height: number }> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPEG, PNG, WebP만 업로드할 수 있습니다.");
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
      element.src = url;
    });
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

function CounterInput({
  fieldId,
  label,
  value,
  min,
  max,
  onChange,
  suffix,
  error,
}: {
  fieldId: string;
  label: string;
  value: number | null;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number | null) => void;
  error?: string;
}) {
  const adjust = (amount: number) => onChange(Math.min(max, Math.max(min, (value ?? min) + amount)));
  return (
    <div className="counter-field">
      <span>{label}</span>
      <div>
        <button type="button" onClick={() => adjust(-1)} aria-label={`${label} 감소`}>
          <Minus size={15} />
        </button>
        <input
          id={fieldId}
          aria-label={label}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          type="number"
          min={min}
          max={max}
          value={value ?? ""}
          onChange={(e) => onChange(numberOrNull(e.target.value))}
        />
        <b>{suffix}</b>
        <button type="button" onClick={() => adjust(1)} aria-label={`${label} 증가`}>
          <Plus size={15} />
        </button>
      </div>
      {error && (
        <small className="inline-error" id={`${fieldId}-error`}>
          {error}
        </small>
      )}
    </div>
  );
}

function ChipGroup<T extends string>({
  fieldId,
  label,
  values,
  selected,
  max,
  onChange,
  error,
}: {
  fieldId: string;
  label: string;
  values: readonly T[];
  selected: string[];
  max: number;
  onChange: (values: string[]) => void;
  error?: string;
}) {
  return (
    <fieldset
      className="chip-field"
      id={fieldId}
      tabIndex={-1}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${fieldId}-error` : undefined}
    >
      <legend>
        {label}
        <small>최대 {max}개</small>
      </legend>
      <div className="chip-row">
        {values.map((value) => {
          const active = selected.includes(value);
          return (
            <button
              type="button"
              className={active ? "active" : ""}
              aria-pressed={active}
              key={value}
              onClick={() =>
                onChange(
                  active
                    ? selected.filter((item) => item !== value)
                    : selected.length < max
                      ? [...selected, value]
                      : selected,
                )
              }
            >
              {active && <Check size={13} />}
              {value}
            </button>
          );
        })}
      </div>
      {error && (
        <small className="inline-error" id={`${fieldId}-error`}>
          {error}
        </small>
      )}
    </fieldset>
  );
}

function RatingField({
  fieldId,
  label,
  value,
  onChange,
  error,
}: {
  fieldId: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
}) {
  return (
    <fieldset
      className="rating-field"
      id={fieldId}
      tabIndex={-1}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${fieldId}-error` : undefined}
    >
      <legend>{label}</legend>
      <div>
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            type="button"
            key={rating}
            aria-label={`${label} ${rating}점`}
            aria-pressed={value === rating}
            onClick={() => onChange(value === rating ? null : rating)}
          >
            {rating <= (value ?? 0) ? "★" : "☆"}
          </button>
        ))}
      </div>
      {error && (
        <small className="inline-error" id={`${fieldId}-error`}>
          {error}
        </small>
      )}
    </fieldset>
  );
}

export function VisitForm({
  initial,
  cafes,
  visitId,
  existingPhotos = [],
}: {
  initial: VisitInput;
  cafes: CafeOption[];
  visitId?: string;
  existingPhotos?: PhotoWithUrl[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [cafeOptions, setCafeOptions] = useState(cafes);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [storedPhotos, setStoredPhotos] = useState(existingPhotos);
  const [dirty, setDirty] = useState(false);
  const [coreDirty, setCoreDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoPreparationPending, setPhotoPreparationPending] = useState(false);
  const [photoMutationPending, setPhotoMutationPending] = useState(false);
  const [savedVisitId, setSavedVisitId] = useState(visitId ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const photosRef = useRef(photos);
  const savingRef = useRef(false);
  const createRequestIdRef = useRef<string | null>(null);
  const photoPreparationCountRef = useRef(0);
  const photoMutationRef = useRef(false);
  const update = <K extends keyof VisitInput>(key: K, value: VisitInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setCoreDirty(true);
  };
  const shouldWarnOnLeave = dirty || photoPreparationPending || saving;

  const averageStayMinutes = form.averageStayPreset ? STAY_MINUTES[form.averageStayPreset] : null;
  const estimate = useMemo(
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

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (shouldWarnOnLeave) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [shouldWarnOnLeave]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl)), []);
  useEffect(() => {
    if (!shouldWarnOnLeave) return;
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
  }, [shouldWarnOnLeave]);

  const chooseCafe = (id: string) => {
    const cafe = cafeOptions.find((item) => item.id === id);
    update("cafeId", id || null);
    if (cafe)
      setForm((current) => ({ ...current, openTime: cafe.latestOpenTime, closeTime: cafe.latestCloseTime }));
  };

  const addMenu = () =>
    update("representativeMenus", [
      ...form.representativeMenus,
      {
        name: "",
        category: "COFFEE",
        price: 0,
        isSignature: false,
        sortOrder: form.representativeMenus.length,
      },
    ]);
  const updateMenu = (index: number, patch: Partial<VisitInput["representativeMenus"][number]>) =>
    update(
      "representativeMenus",
      form.representativeMenus.map((menu, itemIndex) => (itemIndex === index ? { ...menu, ...patch } : menu)),
    );
  const removeMenu = (index: number) =>
    update(
      "representativeMenus",
      form.representativeMenus
        .filter((_, itemIndex) => itemIndex !== index)
        .map((menu, sortOrder) => ({ ...menu, sortOrder })),
    );
  const moveMenu = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= form.representativeMenus.length) return;
    const items = [...form.representativeMenus];
    [items[index], items[target]] = [items[target], items[index]];
    update(
      "representativeMenus",
      items.map((menu, sortOrder) => ({ ...menu, sortOrder })),
    );
  };

  const onFiles = async (kind: PhotoKind, files: FileList | null) => {
    if (!files || savingRef.current) return;
    photoPreparationCountRef.current += 1;
    setPhotoPreparationPending(true);
    setMessage(null);
    const limit = kind === "GENERAL" ? 10 : 3;
    const selected = Array.from(files).slice(0, limit);
    try {
      const processed = await Promise.all(selected.map(processImage));
      setPhotos((current) => {
        const available = availablePhotoSortOrders(
          [
            ...storedPhotos.filter((photo) => photo.kind === kind).map((photo) => photo.sort_order),
            ...current.filter((photo) => photo.kind === kind).map((photo) => photo.sortOrder),
          ],
          limit,
          processed.length,
        );
        return [
          ...current,
          ...processed.slice(0, available.length).map(({ file, width, height }, index) => ({
            id: crypto.randomUUID(),
            file,
            width,
            height,
            sortOrder: available[index],
            kind,
            previewUrl: URL.createObjectURL(file),
            status: "ready" as const,
          })),
        ];
      });
      setDirty(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "사진을 처리하지 못했습니다.");
    } finally {
      photoPreparationCountRef.current -= 1;
      if (photoPreparationCountRef.current === 0) setPhotoPreparationPending(false);
    }
  };

  const uploadPhotos = async (targetVisitId: string) => {
    const supabase = createClient();
    let failed = 0;
    for (const photo of photos) {
      setPhotos((current) =>
        current.map((item) => (item.id === photo.id ? { ...item, status: "uploading" } : item)),
      );
      const prepared = await createPhotoUploadAction({
        visitId: targetVisitId,
        kind: photo.kind,
        mimeType: photo.file.type as "image/webp",
        sizeBytes: photo.file.size,
      });
      if (!prepared.ok) {
        failed += 1;
        setPhotos((current) =>
          current.map((item) => (item.id === photo.id ? { ...item, status: "failed" } : item)),
        );
        continue;
      }
      const upload = await supabase.storage
        .from("cafe-photos")
        .uploadToSignedUrl(prepared.data.path, prepared.data.token, photo.file, {
          contentType: photo.file.type,
          upsert: false,
        });
      if (upload.error) {
        await discardPhotoUploadAction(targetVisitId, prepared.data.path);
        failed += 1;
        setPhotos((current) =>
          current.map((item) => (item.id === photo.id ? { ...item, status: "failed" } : item)),
        );
        continue;
      }
      const finalized = await finalizePhotoUploadAction({
        visitId: targetVisitId,
        kind: photo.kind,
        mimeType: photo.file.type as "image/webp",
        sizeBytes: photo.file.size,
        path: prepared.data.path,
        width: photo.width,
        height: photo.height,
        sortOrder: photo.sortOrder,
      });
      if (!finalized.ok) {
        failed += 1;
        setPhotos((current) =>
          current.map((item) => (item.id === photo.id ? { ...item, status: "failed" } : item)),
        );
      } else {
        URL.revokeObjectURL(photo.previewUrl);
        setStoredPhotos((current) =>
          [...current, finalized.data].sort((a, b) => (a.kind === b.kind ? a.sort_order - b.sort_order : 0)),
        );
        setPhotos((current) => current.filter((item) => item.id !== photo.id));
      }
    }
    return failed;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current || photoPreparationCountRef.current > 0 || photoMutationRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage(null);
    setFieldErrors({});
    try {
      const createRequestId = savedVisitId ? undefined : (createRequestIdRef.current ??= crypto.randomUUID());
      const result =
        savedVisitId && !coreDirty
          ? { ok: true as const, data: { id: savedVisitId, cafe: null } }
          : await saveVisitAction(form, savedVisitId ?? undefined, createRequestId);
      if (!result.ok) {
        setMessage(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        const firstErrorKey = Object.keys(result.fieldErrors ?? {})[0];
        window.setTimeout(() => {
          const target = firstErrorKey ? document.getElementById(`visit-${firstErrorKey}`) : null;
          (target instanceof HTMLElement ? target : errorSummaryRef.current)?.focus();
        }, 0);
        return;
      }
      setSavedVisitId(result.data.id);
      setCoreDirty(false);
      if (result.data.cafe && form.cafeSelectionMode === "NEW") {
        const savedCafe = {
          ...result.data.cafe,
          latestOpenTime: form.openTime,
          latestCloseTime: form.closeTime,
        };
        setCafeOptions((current) =>
          current.some((item) => item.id === savedCafe.id) ? current : [...current, savedCafe],
        );
        setForm((current) => ({
          ...current,
          cafeSelectionMode: "EXISTING",
          cafeId: savedCafe.id,
          cafeName: null,
          region: null,
        }));
      }
      const failed = await uploadPhotos(result.data.id);
      if (failed) {
        setMessage(`기록은 저장됐지만 사진 ${failed}장을 올리지 못했습니다. 다시 저장하면 재시도합니다.`);
        setDirty(true);
        return;
      }
      setDirty(false);
      router.push(`/visits/${result.data.id}`);
      router.refresh();
    } catch {
      setMessage("저장 중 연결이 끊겼습니다. 다시 저장해 주세요.");
      setDirty(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const removeStored = async (photo: PhotoWithUrl) => {
    if (!savedVisitId || savingRef.current || photoMutationRef.current) return;
    photoMutationRef.current = true;
    setPhotoMutationPending(true);
    try {
      const result = await removePhotoAction(photo.id, savedVisitId);
      if (result.ok) {
        setStoredPhotos((current) => current.filter((item) => item.id !== photo.id));
        if (result.data.cleanupPending)
          setMessage(
            "사진 정보는 제거됐지만 Storage 정리가 지연됐습니다. 운영 점검에서 고아 사진을 정리해 주세요.",
          );
      } else setMessage(result.error);
    } catch {
      setMessage("사진을 제거하지 못했습니다.");
    } finally {
      photoMutationRef.current = false;
      setPhotoMutationPending(false);
    }
  };

  const moveStored = async (photo: PhotoWithUrl, direction: -1 | 1) => {
    if (!savedVisitId || savingRef.current || photoMutationRef.current) return;
    const subset = storedPhotos.filter((item) => item.kind === photo.kind);
    const index = subset.findIndex((item) => item.id === photo.id);
    const target = index + direction;
    if (target < 0 || target >= subset.length) return;
    [subset[index], subset[target]] = [subset[target], subset[index]];
    let cursor = 0;
    const reordered = storedPhotos.map((item) =>
      item.kind === photo.kind ? { ...subset[cursor], sort_order: cursor++ } : item,
    );
    photoMutationRef.current = true;
    setPhotoMutationPending(true);
    setStoredPhotos(reordered);
    try {
      const result = await reorderPhotosAction(
        savedVisitId,
        photo.kind,
        subset.map((item) => item.id),
      );
      if (!result.ok) {
        setStoredPhotos(storedPhotos);
        setMessage(result.error);
      }
    } catch {
      setStoredPhotos(storedPhotos);
      setMessage("사진 순서를 변경하지 못했습니다.");
    } finally {
      photoMutationRef.current = false;
      setPhotoMutationPending(false);
    }
  };

  const errorFor = (key: string) => fieldErrors[key]?.[0];
  const fieldId = (key: string) => `visit-${key}`;
  const errorDescriptionId = (key: string) => (errorFor(key) ? `${fieldId(key)}-error` : undefined);
  return (
    <form ref={formRef} onSubmit={submit} className="visit-form" noValidate aria-busy={saving}>
      <fieldset className="form-lock" disabled={saving}>
        <div className="form-main">
          <header className="form-heading">
            <p className="eyebrow">FIELD ENTRY</p>
            <h1>{visitId ? "방문 기록 수정" : "새 방문 기록"}</h1>
            <p>관찰한 사실과 판단한 추정을 차근차근 구분해 기록하세요.</p>
          </header>
          {Object.keys(fieldErrors).length > 0 && (
            <div className="field-error-summary" role="alert" tabIndex={-1} ref={errorSummaryRef}>
              <strong>확인이 필요한 입력이 있습니다.</strong>
              <ul>
                {Object.entries(fieldErrors).flatMap(([key, errors]) =>
                  errors.map((error) => (
                    <li key={`${key}-${error}`}>
                      <a
                        href={`#${fieldId(key)}`}
                        onClick={() =>
                          window.setTimeout(() => document.getElementById(fieldId(key))?.focus(), 0)
                        }
                      >
                        {VISIT_FIELD_LABELS[key] ? `${VISIT_FIELD_LABELS[key]}: ` : ""}
                        {error}
                      </a>
                    </li>
                  )),
                )}
              </ul>
            </div>
          )}

          <section className="form-section" aria-labelledby="basic-title">
            <div className="section-number">01</div>
            <div className="section-content">
              <h2 id="basic-title">기본 정보</h2>
              <div className="segmented">
                <button
                  type="button"
                  className={form.cafeSelectionMode === "NEW" ? "active" : ""}
                  onClick={() => update("cafeSelectionMode", "NEW")}
                >
                  새 카페
                </button>
                <button
                  type="button"
                  className={form.cafeSelectionMode === "EXISTING" ? "active" : ""}
                  onClick={() => update("cafeSelectionMode", "EXISTING")}
                >
                  기존 카페
                </button>
              </div>
              {form.cafeSelectionMode === "EXISTING" ? (
                <label className="field">
                  <span>카페 선택</span>
                  <select
                    id={fieldId("cafeId")}
                    value={form.cafeId ?? ""}
                    onChange={(e) => chooseCafe(e.target.value)}
                    aria-invalid={Boolean(errorFor("cafeId"))}
                    aria-describedby={errorDescriptionId("cafeId")}
                  >
                    <option value="">선택하세요</option>
                    {cafeOptions.map((cafe) => (
                      <option key={cafe.id} value={cafe.id}>
                        {cafe.name} · {cafe.region}
                      </option>
                    ))}
                  </select>
                  <small id={`${fieldId("cafeId")}-error`}>{errorFor("cafeId")}</small>
                </label>
              ) : (
                <div className="field-grid">
                  <label className="field">
                    <span>카페명</span>
                    <input
                      id={fieldId("cafeName")}
                      value={form.cafeName ?? ""}
                      maxLength={60}
                      onChange={(e) => update("cafeName", e.target.value)}
                      aria-invalid={Boolean(errorFor("cafeName"))}
                      aria-describedby={errorDescriptionId("cafeName")}
                    />
                    <small id={`${fieldId("cafeName")}-error`}>{errorFor("cafeName")}</small>
                  </label>
                  <label className="field">
                    <span>지역</span>
                    <input
                      id={fieldId("region")}
                      value={form.region ?? ""}
                      maxLength={60}
                      onChange={(e) => update("region", e.target.value)}
                      aria-invalid={Boolean(errorFor("region"))}
                      aria-describedby={errorDescriptionId("region")}
                    />
                    <small id={`${fieldId("region")}-error`}>{errorFor("region")}</small>
                  </label>
                </div>
              )}
              <div className="field-grid">
                <label className="field">
                  <span>방문 일시</span>
                  <input
                    id={fieldId("visitedAt")}
                    type="datetime-local"
                    value={toSeoulLocalDateTime(form.visitedAt)}
                    onChange={(e) =>
                      update("visitedAt", seoulLocalDateTimeToIso(e.target.value) ?? e.target.value)
                    }
                    aria-invalid={Boolean(errorFor("visitedAt"))}
                    aria-describedby={errorDescriptionId("visitedAt")}
                  />
                  <small id={`${fieldId("visitedAt")}-error`}>{errorFor("visitedAt")}</small>
                </label>
                <label className="field">
                  <span>관찰 시간</span>
                  <div className="input-suffix">
                    <input
                      id={fieldId("observationDurationMinutes")}
                      type="number"
                      min="1"
                      max="180"
                      value={form.observationDurationMinutes ?? ""}
                      onChange={(e) => update("observationDurationMinutes", numberOrNull(e.target.value))}
                      aria-invalid={Boolean(errorFor("observationDurationMinutes"))}
                      aria-describedby={errorDescriptionId("observationDurationMinutes")}
                    />
                    <b>분</b>
                  </div>
                  <small id={`${fieldId("observationDurationMinutes")}-error`}>
                    {errorFor("observationDurationMinutes")}
                  </small>
                </label>
              </div>
              <ChipGroup
                fieldId={fieldId("moodTags")}
                label="분위기"
                values={MOOD_TAGS}
                selected={form.moodTags}
                max={5}
                onChange={(value) => update("moodTags", value)}
                error={errorFor("moodTags")}
              />
              <ChipGroup
                fieldId={fieldId("customerTypes")}
                label="고객 유형"
                values={CUSTOMER_TYPES}
                selected={form.customerTypes}
                max={3}
                onChange={(value) => update("customerTypes", value)}
                error={errorFor("customerTypes")}
              />
              <ChipGroup
                fieldId={fieldId("visitPurposes")}
                label="방문 목적"
                values={VISIT_PURPOSES}
                selected={form.visitPurposes}
                max={3}
                onChange={(value) => update("visitPurposes", value)}
                error={errorFor("visitPurposes")}
              />
              <PhotoPicker
                kind="GENERAL"
                title="일반 사진"
                photos={photos}
                stored={storedPhotos}
                onFiles={onFiles}
                setPhotos={setPhotos}
                onRemoveStored={removeStored}
                onMoveStored={moveStored}
                disabled={saving || photoPreparationPending || photoMutationPending}
              />
            </div>
          </section>

          <section className="form-section" aria-labelledby="menu-title">
            <div className="section-number">02</div>
            <div className="section-content">
              <h2 id="menu-title">메뉴 / 가격</h2>
              <PhotoPicker
                kind="MENU_BOARD"
                title="메뉴판 사진"
                photos={photos}
                stored={storedPhotos}
                onFiles={onFiles}
                setPhotos={setPhotos}
                onRemoveStored={removeStored}
                onMoveStored={moveStored}
                disabled={saving || photoPreparationPending || photoMutationPending}
              />
              <div className="subheading">
                <div>
                  <h3>대표 메뉴</h3>
                  <p>3~5개를 추천하며 최대 10개까지 저장합니다.</p>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={addMenu}
                  disabled={form.representativeMenus.length >= 10}
                >
                  <Plus size={15} /> 메뉴 추가
                </button>
              </div>
              <div
                className="menu-list"
                id={fieldId("representativeMenus")}
                tabIndex={-1}
                aria-invalid={Boolean(errorFor("representativeMenus"))}
                aria-describedby={errorDescriptionId("representativeMenus")}
              >
                {form.representativeMenus.map((menu, index) => (
                  <div className="menu-row" key={menu.id ?? index}>
                    <div className="sort-controls">
                      <button
                        type="button"
                        onClick={() => moveMenu(index, -1)}
                        disabled={index === 0}
                        aria-label="위로"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveMenu(index, 1)}
                        disabled={index === form.representativeMenus.length - 1}
                        aria-label="아래로"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                    <input
                      aria-label={`메뉴 ${index + 1} 이름`}
                      aria-invalid={Boolean(errorFor("representativeMenus"))}
                      aria-describedby={errorDescriptionId("representativeMenus")}
                      placeholder="메뉴명"
                      value={menu.name}
                      maxLength={40}
                      onChange={(e) => updateMenu(index, { name: e.target.value })}
                    />
                    <select
                      aria-label={`메뉴 ${index + 1} 카테고리`}
                      aria-invalid={Boolean(errorFor("representativeMenus"))}
                      aria-describedby={errorDescriptionId("representativeMenus")}
                      value={menu.category}
                      onChange={(e) =>
                        updateMenu(index, { category: e.target.value as typeof menu.category })
                      }
                    >
                      {MENU_CATEGORIES.map((value) => (
                        <option key={value} value={value}>
                          {LABELS.category[value]}
                        </option>
                      ))}
                    </select>
                    <div className="input-suffix">
                      <input
                        aria-label={`메뉴 ${index + 1} 가격`}
                        aria-invalid={Boolean(errorFor("representativeMenus"))}
                        aria-describedby={errorDescriptionId("representativeMenus")}
                        type="number"
                        min="0"
                        max="100000"
                        value={menu.price}
                        onChange={(e) => updateMenu(index, { price: Number(e.target.value) })}
                      />
                      <b>원</b>
                    </div>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={menu.isSignature}
                        onChange={(e) => updateMenu(index, { isSignature: e.target.checked })}
                      />
                      시그니처
                    </label>
                    <button
                      type="button"
                      className="icon-button danger"
                      aria-label="메뉴 삭제"
                      onClick={() => removeMenu(index)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                {errorFor("representativeMenus") && (
                  <small className="inline-error" id={`${fieldId("representativeMenus")}-error`}>
                    {errorFor("representativeMenus")}
                  </small>
                )}
              </div>
              <fieldset
                className="choice-field"
                id={fieldId("priceLevel")}
                tabIndex={-1}
                aria-invalid={Boolean(errorFor("priceLevel"))}
                aria-describedby={errorDescriptionId("priceLevel")}
              >
                <legend>
                  가격 수준 <span className="source-badge user-estimate">사용자 추정</span>
                </legend>
                <div className="choice-grid four">
                  {PRICE_LEVELS.map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={form.priceLevel === value ? "active" : ""}
                      onClick={() => update("priceLevel", form.priceLevel === value ? null : value)}
                    >
                      {LABELS.price[value]}
                    </button>
                  ))}
                </div>
                {errorFor("priceLevel") && (
                  <small className="inline-error" id={`${fieldId("priceLevel")}-error`}>
                    {errorFor("priceLevel")}
                  </small>
                )}
              </fieldset>
              <label className="field spend-field">
                <span>
                  예상 객단가 <i className="source-badge user-estimate">사용자 추정</i>
                </span>
                <div className="quick-values">
                  {[6000, 8000, 10000, 12000].map((value) => (
                    <button type="button" key={value} onClick={() => update("estimatedAverageSpend", value)}>
                      {value / 1000}천
                    </button>
                  ))}
                </div>
                <div className="input-suffix">
                  <input
                    id={fieldId("estimatedAverageSpend")}
                    type="number"
                    min="1000"
                    max="100000"
                    value={form.estimatedAverageSpend ?? ""}
                    onChange={(e) => update("estimatedAverageSpend", numberOrNull(e.target.value))}
                    aria-invalid={Boolean(errorFor("estimatedAverageSpend"))}
                    aria-describedby={errorDescriptionId("estimatedAverageSpend")}
                  />
                  <b>원</b>
                </div>
                <small id={`${fieldId("estimatedAverageSpend")}-error`}>
                  {errorFor("estimatedAverageSpend") ??
                    "한 고객이 한 번 방문해 실제로 사용하는 금액을 추정해 주세요."}
                </small>
              </label>
            </div>
          </section>

          <section className="form-section" aria-labelledby="customer-title">
            <div className="section-number">03</div>
            <div className="section-content">
              <h2 id="customer-title">좌석 / 고객</h2>
              <div className="counter-grid">
                <CounterInput
                  fieldId={fieldId("tableCount")}
                  label="테이블 수"
                  value={form.tableCount}
                  min={0}
                  max={100}
                  suffix="개"
                  onChange={(value) => update("tableCount", value)}
                  error={errorFor("tableCount")}
                />
                <CounterInput
                  fieldId={fieldId("seatCount")}
                  label="좌석 수"
                  value={form.seatCount}
                  min={1}
                  max={300}
                  suffix="석"
                  onChange={(value) => update("seatCount", value)}
                  error={errorFor("seatCount")}
                />
              </div>
              <div
                className="segmented"
                id={fieldId("occupancyInputMode")}
                tabIndex={-1}
                aria-invalid={Boolean(errorFor("occupancyInputMode"))}
                aria-describedby={errorDescriptionId("occupancyInputMode")}
              >
                <button
                  type="button"
                  className={form.occupancyInputMode !== "RATE" ? "active" : ""}
                  onClick={() => {
                    update("occupancyInputMode", "CUSTOMERS");
                    update("occupancyRate", null);
                  }}
                >
                  고객 수로 입력
                </button>
                <button
                  type="button"
                  className={form.occupancyInputMode === "RATE" ? "active" : ""}
                  onClick={() => {
                    update("occupancyInputMode", "RATE");
                    update("currentCustomers", null);
                  }}
                >
                  점유율로 입력
                </button>
              </div>
              {errorFor("occupancyInputMode") && (
                <small className="inline-error" id={`${fieldId("occupancyInputMode")}-error`}>
                  {errorFor("occupancyInputMode")}
                </small>
              )}
              {form.occupancyInputMode === "RATE" ? (
                <CounterInput
                  fieldId={fieldId("occupancyRate")}
                  label="현재 점유율"
                  value={form.occupancyRate}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(value) => update("occupancyRate", value)}
                  error={errorFor("occupancyRate")}
                />
              ) : (
                <CounterInput
                  fieldId={fieldId("currentCustomers")}
                  label="현재 고객"
                  value={form.currentCustomers}
                  min={0}
                  max={500}
                  suffix="명"
                  onChange={(value) => update("currentCustomers", value)}
                  error={errorFor("currentCustomers")}
                />
              )}
              <div className="occupancy-readout">
                <span>
                  계산 점유율 <i className="source-badge calculated">시스템 계산</i>
                </span>
                <strong>
                  {estimate.isOverCapacity
                    ? "100%+"
                    : estimate.occupancyRate === null
                      ? "-"
                      : `${estimate.occupancyRate}%`}
                </strong>
              </div>
              <fieldset
                className="choice-field"
                id={fieldId("averageStayPreset")}
                tabIndex={-1}
                aria-invalid={Boolean(errorFor("averageStayPreset"))}
                aria-describedby={errorDescriptionId("averageStayPreset")}
              >
                <legend>
                  평균 체류시간 <span className="source-badge user-estimate">사용자 추정</span>
                </legend>
                <div className="choice-grid five">
                  {STAY_PRESETS.map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={form.averageStayPreset === value ? "active" : ""}
                      onClick={() => update("averageStayPreset", value)}
                    >
                      {LABELS.stay[value]}
                    </button>
                  ))}
                </div>
                {errorFor("averageStayPreset") && (
                  <small className="inline-error" id={`${fieldId("averageStayPreset")}-error`}>
                    {errorFor("averageStayPreset")}
                  </small>
                )}
              </fieldset>
            </div>
          </section>

          <section className="form-section" aria-labelledby="operation-title">
            <div className="section-number">04</div>
            <div className="section-content">
              <h2 id="operation-title">운영 / 테이크아웃</h2>
              <div className="field-grid three">
                <label className="field">
                  <span>오픈</span>
                  <input
                    id={fieldId("openTime")}
                    type="time"
                    value={form.openTime ?? ""}
                    onChange={(e) => update("openTime", e.target.value || null)}
                    aria-invalid={Boolean(errorFor("openTime"))}
                    aria-describedby={errorDescriptionId("openTime")}
                  />
                  <small id={`${fieldId("openTime")}-error`}>{errorFor("openTime")}</small>
                </label>
                <label className="field">
                  <span>마감</span>
                  <input
                    id={fieldId("closeTime")}
                    type="time"
                    value={form.closeTime ?? ""}
                    onChange={(e) => update("closeTime", e.target.value || null)}
                    aria-invalid={Boolean(errorFor("closeTime"))}
                    aria-describedby={errorDescriptionId("closeTime")}
                  />
                  <small id={`${fieldId("closeTime")}-error`}>{errorFor("closeTime")}</small>
                </label>
                <label className="field">
                  <span>월 영업일</span>
                  <div className="input-suffix">
                    <input
                      id={fieldId("operatingDaysPerMonth")}
                      type="number"
                      min="1"
                      max="31"
                      value={form.operatingDaysPerMonth}
                      onChange={(e) => update("operatingDaysPerMonth", Number(e.target.value))}
                      aria-invalid={Boolean(errorFor("operatingDaysPerMonth"))}
                      aria-describedby={errorDescriptionId("operatingDaysPerMonth")}
                    />
                    <b>일</b>
                  </div>
                  <small id={`${fieldId("operatingDaysPerMonth")}-error`}>
                    {errorFor("operatingDaysPerMonth")}
                  </small>
                </label>
              </div>
              <p className="derived-note">
                총 영업시간{" "}
                <strong>{estimate.operatingHours === null ? "-" : `${estimate.operatingHours}시간`}</strong> ·
                자정 이후 마감도 지원합니다.
              </p>
              <fieldset
                className="choice-field"
                id={fieldId("takeoutLevel")}
                tabIndex={-1}
                aria-invalid={Boolean(errorFor("takeoutLevel"))}
                aria-describedby={errorDescriptionId("takeoutLevel")}
              >
                <legend>
                  테이크아웃 수준 <span className="source-badge user-estimate">사용자 추정</span>
                </legend>
                <div className="choice-grid four">
                  {TAKEOUT_LEVELS.map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={form.takeoutLevel === value ? "active" : ""}
                      onClick={() => update("takeoutLevel", value)}
                    >
                      {LABELS.takeout[value]}
                    </button>
                  ))}
                </div>
                {errorFor("takeoutLevel") && (
                  <small className="inline-error" id={`${fieldId("takeoutLevel")}-error`}>
                    {errorFor("takeoutLevel")}
                  </small>
                )}
              </fieldset>
              <CounterInput
                fieldId={fieldId("observedTakeoutOrders")}
                label="15분간 테이크아웃 주문"
                value={form.observedTakeoutOrders}
                min={0}
                max={50}
                suffix="건"
                onChange={(value) => update("observedTakeoutOrders", value)}
                error={errorFor("observedTakeoutOrders")}
              />
              {form.observedTakeoutOrders !== null && (
                <p className="derived-note">관찰 주문 수가 테이크아웃 수준보다 우선합니다.</p>
              )}
            </div>
          </section>

          <section className="form-section" aria-labelledby="review-title">
            <div className="section-number">05</div>
            <div className="section-content">
              <h2 id="review-title">분위기 / 평가 / 메모</h2>
              <div className="rating-grid">
                <RatingField
                  fieldId={fieldId("spaceRating")}
                  label="공간"
                  value={form.spaceRating}
                  onChange={(value) => update("spaceRating", value)}
                  error={errorFor("spaceRating")}
                />
                <RatingField
                  fieldId={fieldId("menuRating")}
                  label="메뉴"
                  value={form.menuRating}
                  onChange={(value) => update("menuRating", value)}
                  error={errorFor("menuRating")}
                />
                <RatingField
                  fieldId={fieldId("locationRating")}
                  label="입지"
                  value={form.locationRating}
                  onChange={(value) => update("locationRating", value)}
                  error={errorFor("locationRating")}
                />
                <RatingField
                  fieldId={fieldId("overallRating")}
                  label="전체"
                  value={form.overallRating}
                  onChange={(value) => update("overallRating", value)}
                  error={errorFor("overallRating")}
                />
              </div>
              <label className="field">
                <span>잘한 점</span>
                <textarea
                  id={fieldId("strengths")}
                  maxLength={500}
                  rows={4}
                  value={form.strengths ?? ""}
                  onChange={(e) => update("strengths", e.target.value)}
                  placeholder="동선, 메뉴 구성, 고객 경험에서 잘한 점"
                  aria-invalid={Boolean(errorFor("strengths"))}
                  aria-describedby={errorDescriptionId("strengths")}
                />
                <small id={`${fieldId("strengths")}-error`}>
                  {errorFor("strengths") ?? `${(form.strengths ?? "").length}/500`}
                </small>
              </label>
              <label className="field">
                <span>가져오고 싶은 점</span>
                <textarea
                  id={fieldId("adoptablePoints")}
                  maxLength={500}
                  rows={4}
                  value={form.adoptablePoints ?? ""}
                  onChange={(e) => update("adoptablePoints", e.target.value)}
                  placeholder="내 카페에 적용하고 싶은 구체적인 요소"
                  aria-invalid={Boolean(errorFor("adoptablePoints"))}
                  aria-describedby={errorDescriptionId("adoptablePoints")}
                />
                <small id={`${fieldId("adoptablePoints")}-error`}>
                  {errorFor("adoptablePoints") ?? `${(form.adoptablePoints ?? "").length}/500`}
                </small>
              </label>
            </div>
          </section>
        </div>

        <aside className="estimate-sidebar">
          <div className="estimate-card">
            <div className="estimate-title">
              <div>
                <p className="eyebrow">LIVE ESTIMATE</p>
                <h2>예상 매출</h2>
              </div>
              <span className={`confidence-pill confidence-${estimate.confidenceLevel.toLowerCase()}`}>
                {confidenceDots(estimate.confidenceLevel)}
              </span>
            </div>
            {!estimate.canEstimate ? (
              <div className="estimate-missing">
                <strong>추정 불가</strong>
                <p>아래 값을 채우면 즉시 계산합니다.</p>
                <ul>
                  {estimate.missingFields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <div className="metric-pair">
                  <div>
                    <span>시간당 회전율</span>
                    <strong>{estimate.estimatedSeatTurnsPerHour?.toFixed(2)}회</strong>
                  </div>
                  <div>
                    <span>시간당 고객</span>
                    <strong>{estimate.estimatedCustomersPerHour?.toFixed(1)}명</strong>
                  </div>
                </div>
                <div className="scenario-table">
                  <div className="scenario-head">
                    <span></span>
                    <span>보수</span>
                    <span>기준</span>
                    <span>활황</span>
                  </div>
                  <div>
                    <b>일 방문객</b>
                    <span>{formatNumber(estimate.scenarios.low?.customers)}</span>
                    <span>{formatNumber(estimate.scenarios.base?.customers)}</span>
                    <span>{formatNumber(estimate.scenarios.high?.customers)}</span>
                  </div>
                  <div>
                    <b>일매출</b>
                    <span>{formatCompactKrw(estimate.scenarios.low?.dailySales)}</span>
                    <span className="featured">{formatCompactKrw(estimate.scenarios.base?.dailySales)}</span>
                    <span>{formatCompactKrw(estimate.scenarios.high?.dailySales)}</span>
                  </div>
                  <div>
                    <b>월매출</b>
                    <span>{formatCompactKrw(estimate.scenarios.low?.monthlySales)}</span>
                    <span className="featured">
                      {formatCompactKrw(estimate.scenarios.base?.monthlySales)}
                    </span>
                    <span>{formatCompactKrw(estimate.scenarios.high?.monthlySales)}</span>
                  </div>
                </div>
                <div className="estimate-detail">
                  <span>적용 객단가</span>
                  <b>{formatKrw(form.estimatedAverageSpend)}</b>
                  <span>테이크아웃 보정</span>
                  <b>+{Math.round(estimate.takeoutAdjustmentRate * 100)}%</b>
                </div>
              </>
            )}
            <div className="confidence-explain">
              <span>신뢰도 {estimate.confidenceScore}/100</span>
              <small>입력 항목과 관찰 시간으로 자동 계산</small>
            </div>
            {message && (
              <p className="form-error save-message" role="alert">
                {message}
              </p>
            )}
            <button
              className="save-button"
              type="submit"
              disabled={saving || photoPreparationPending || photoMutationPending}
            >
              <Save size={18} />
              {saving ? "저장 중…" : "저장"}
            </button>
            <p className="disclaimer">현장 관찰을 기반으로 한 추정치이며 실제 재무 데이터가 아닙니다.</p>
          </div>
        </aside>
      </fieldset>
    </form>
  );
}

function PhotoPicker({
  kind,
  title,
  photos,
  stored,
  onFiles,
  setPhotos,
  onRemoveStored,
  onMoveStored,
  disabled,
}: {
  kind: PhotoKind;
  title: string;
  photos: PendingPhoto[];
  stored: PhotoWithUrl[];
  onFiles: (kind: PhotoKind, files: FileList | null) => void;
  setPhotos: React.Dispatch<React.SetStateAction<PendingPhoto[]>>;
  onRemoveStored: (photo: PhotoWithUrl) => void;
  onMoveStored: (photo: PhotoWithUrl, direction: -1 | 1) => void;
  disabled: boolean;
}) {
  const current = photos.filter((photo) => photo.kind === kind).sort((a, b) => a.sortOrder - b.sortOrder);
  const existing = stored.filter((photo) => photo.kind === kind).sort((a, b) => a.sort_order - b.sort_order);
  const limit = kind === "GENERAL" ? 10 : 3;
  const move = (id: string, direction: -1 | 1) =>
    setPhotos((all) => swapPendingPhotoOrder(all, id, kind, direction));
  return (
    <div className="photo-picker">
      <div className="subheading">
        <div>
          <h3>{title}</h3>
          <p>
            {kind === "GENERAL" ? "공간과 외관" : "OCR 없이 참고용으로 저장"} · 최대 {limit}장
          </p>
        </div>
        <label className="secondary-button file-button">
          <ImagePlus size={15} />
          <span>사진 선택</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => {
              onFiles(kind, e.target.files);
              e.target.value = "";
            }}
            disabled={disabled || current.length + existing.length >= limit}
          />
        </label>
      </div>
      <div className="photo-strip">
        {existing.map((photo, index) => (
          <div className="photo-item" key={photo.id}>
            {photo.signedUrl ? <img src={photo.signedUrl} alt={`${title} 저장 사진`} /> : <Camera />}
            <div className="photo-controls">
              <button
                type="button"
                onClick={() => onMoveStored(photo, -1)}
                disabled={disabled || current.length > 0 || index === 0}
                aria-label="저장 사진 앞으로"
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => onMoveStored(photo, 1)}
                disabled={disabled || current.length > 0 || index === existing.length - 1}
                aria-label="저장 사진 뒤로"
              >
                <ArrowDown size={12} />
              </button>
              <button
                type="button"
                onClick={() => onRemoveStored(photo)}
                disabled={disabled}
                aria-label="저장 사진 제거"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        {current.map((photo, index) => (
          <div className={`photo-item ${photo.status}`} key={photo.id}>
            <img src={photo.previewUrl} alt={`${title} 업로드 예정 ${index + 1}`} />
            <div className="photo-controls">
              <button
                type="button"
                onClick={() => move(photo.id, -1)}
                disabled={disabled || index === 0}
                aria-label="사진 앞으로"
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => move(photo.id, 1)}
                disabled={disabled || index === current.length - 1}
                aria-label="사진 뒤로"
              >
                <ArrowDown size={12} />
              </button>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(photo.previewUrl);
                  setPhotos((items) => items.filter((item) => item.id !== photo.id));
                }}
                disabled={disabled}
                aria-label="예정 사진 제거"
              >
                <Trash2 size={12} />
              </button>
            </div>
            {photo.status !== "ready" && <span>{photo.status === "uploading" ? "업로드 중" : "실패"}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
