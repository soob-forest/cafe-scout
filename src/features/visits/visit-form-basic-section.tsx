import { CUSTOMER_TYPES, MOOD_TAGS, VISIT_PURPOSES } from "@/domain/types";
import { seoulLocalDateTimeToIso, toSeoulLocalDateTime } from "@/lib/seoul-datetime";
import { ChipGroup, numberOrNull } from "./visit-form-fields";
import { PhotoPicker } from "./visit-photo-picker";
import { useVisitForm } from "./visit-form-context";

export function VisitFormBasicSection() {
  return (
    <section className="form-section" aria-labelledby="basic-title">
      <div className="section-number">01</div>
      <div className="section-content">
        <h2 id="basic-title">기본 정보</h2>
        <CafeMode />
        <CafeFields />
        <VisitTimingFields />
        <VisitTagFields />
        <GeneralPhotoField />
      </div>
    </section>
  );
}

function CafeMode() {
  const { form, update } = useVisitForm();
  return (
    <div className="segmented">
      {(["NEW", "EXISTING"] as const).map((mode) => (
        <button
          type="button"
          key={mode}
          className={form.cafeSelectionMode === mode ? "active" : ""}
          onClick={() => update("cafeSelectionMode", mode)}
        >
          {mode === "NEW" ? "새 카페" : "기존 카페"}
        </button>
      ))}
    </div>
  );
}

function CafeFields() {
  const { form, cafeOptions, update, chooseCafe, errorFor, fieldId, errorDescriptionId } = useVisitForm();
  if (form.cafeSelectionMode === "EXISTING") {
    return (
      <label className="field">
        <span>카페 선택</span>
        <select
          id={fieldId("cafeId")}
          value={form.cafeId ?? ""}
          onChange={(event) => chooseCafe(event.target.value)}
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
    );
  }
  return (
    <div className="field-grid">
      <CafeTextField field="cafeName" label="카페명" value={form.cafeName} onChange={update} />
      <CafeTextField field="region" label="지역" value={form.region} onChange={update} />
    </div>
  );
}

function CafeTextField({
  field,
  label,
  value,
  onChange,
}: {
  field: "cafeName" | "region";
  label: string;
  value: string | null;
  onChange: (field: "cafeName" | "region", value: string) => void;
}) {
  const { errorFor, fieldId, errorDescriptionId } = useVisitForm();
  return (
    <label className="field">
      <span>{label}</span>
      <input
        id={fieldId(field)}
        value={value ?? ""}
        maxLength={60}
        onChange={(event) => onChange(field, event.target.value)}
        aria-invalid={Boolean(errorFor(field))}
        aria-describedby={errorDescriptionId(field)}
      />
      <small id={`${fieldId(field)}-error`}>{errorFor(field)}</small>
    </label>
  );
}

function VisitTimingFields() {
  const { form, update, errorFor, fieldId, errorDescriptionId } = useVisitForm();
  return (
    <div className="field-grid">
      <label className="field">
        <span>방문 일시</span>
        <input
          id={fieldId("visitedAt")}
          type="datetime-local"
          value={toSeoulLocalDateTime(form.visitedAt)}
          onChange={(event) =>
            update("visitedAt", seoulLocalDateTimeToIso(event.target.value) ?? event.target.value)
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
            onChange={(event) => update("observationDurationMinutes", numberOrNull(event.target.value))}
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
  );
}

function VisitTagFields() {
  const { form, update, errorFor, fieldId } = useVisitForm();
  return (
    <>
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
    </>
  );
}

function GeneralPhotoField() {
  const form = useVisitForm();
  return (
    <PhotoPicker
      kind="GENERAL"
      title="일반 사진"
      photos={form.photos}
      stored={form.storedPhotos}
      onFiles={form.onFiles}
      setPhotos={form.setPhotos}
      onRemoveStored={form.removeStored}
      onMoveStored={form.moveStored}
      disabled={form.saving || form.photoPreparationPending || form.photoMutationPending}
    />
  );
}
